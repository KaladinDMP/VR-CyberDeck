import { join } from 'path'
import { promises as fs, promises as fsPromises } from 'fs'
import { execa, ExecaError } from 'execa'
import crypto from 'crypto'
import { QueueManager } from './queueManager'
import dependencyService from '../dependencyService'
import mirrorService from '../mirrorService'
import settingsService from '../settingsService'
import { DownloadItem } from '@shared/types'
import { DownloadStatus } from '@shared/types'
import { getAvailableDiskSpace, parseSizeToBytes, formatBytes } from './utils'

// Type for VRP config - adjust if needed elsewhere
interface VrpConfig {
  baseUri?: string
  password?: string
}

// Unified download controller that handles download cancellation
interface DownloadController {
  cancel: () => void // Cancel the download (kills rclone process)
}

export class DownloadProcessor {
  private activeDownloads: Map<string, DownloadController> = new Map()
  private queueManager: QueueManager
  private vrpConfig: VrpConfig | null = null
  private debouncedEmitUpdate: () => void

  constructor(queueManager: QueueManager, debouncedEmitUpdate: () => void) {
    this.queueManager = queueManager
    this.debouncedEmitUpdate = debouncedEmitUpdate
  }

  public setVrpConfig(config: VrpConfig | null): void {
    this.vrpConfig = config
  }

  // Add getter for vrpConfig
  public getVrpConfig(): VrpConfig | null {
    return this.vrpConfig
  }

  // Centralized update method using QueueManager and emitting update
  private updateItemStatus(
    releaseName: string,
    status: DownloadStatus,
    progress: number,
    error?: string,
    speed?: string,
    eta?: string,
    extractProgress?: number
  ): void {
    const updates: Partial<DownloadItem> = { status, progress, error, speed, eta }
    if (extractProgress !== undefined) {
      updates.extractProgress = extractProgress
    } else if (status !== 'Extracting' && status !== 'Completed') {
      updates.extractProgress = undefined
    }
    const updated = this.queueManager.updateItem(releaseName, updates)
    if (updated) {
      this.debouncedEmitUpdate() // Use the passed-in emitter
    }
  }

  public cancelDownload(
    releaseName: string,
    finalStatus: 'Cancelled' | 'Error' = 'Cancelled',
    errorMsg?: string
  ): void {
    const downloadController = this.activeDownloads.get(releaseName)
    if (downloadController) {
      console.log(`[DownProc] Cancelling download for ${releaseName}...`)
      try {
        downloadController.cancel()
        console.log(`[DownProc] Cancelled download for ${releaseName}.`)
      } catch (cancelError) {
        console.error(`[DownProc] Error cancelling download for ${releaseName}:`, cancelError)
      }
      this.activeDownloads.delete(releaseName)
    } else {
      console.log(`[DownProc] No active download found for ${releaseName} to cancel.`)
    }

    // QueueManager handles the status update logic now
    const item = this.queueManager.findItem(releaseName)
    if (item) {
      const updates: Partial<DownloadItem> = { pid: undefined }
      if (!(item.status === 'Error' && finalStatus === 'Cancelled')) {
        updates.status = finalStatus
      }
      if (finalStatus === 'Cancelled') {
        updates.progress = 0
      }
      if (finalStatus === 'Error') {
        updates.error = errorMsg || item.error
      } else {
        updates.error = undefined
      }

      const updated = this.queueManager.updateItem(releaseName, updates)
      if (updated) {
        console.log(
          `[DownProc] Updated status for ${releaseName} to ${finalStatus} via QueueManager.`
        )
        this.debouncedEmitUpdate() // Ensure UI update on cancel
      } else {
        console.warn(`[DownProc] Failed to update item ${releaseName} during cancellation.`)
      }
    } else {
      console.warn(`[DownProc] Item ${releaseName} not found in queue during cancellation.`)
    }
    // The main service will handle resetting isProcessing and calling processQueue
  }

  public async startDownload(
    item: DownloadItem
  ): Promise<{ success: boolean; startExtraction: boolean; finalState?: DownloadItem }> {
    console.log(`[DownProc] Starting download for ${item.releaseName}...`)

    if (!this.vrpConfig?.baseUri || !this.vrpConfig?.password) {
      console.error('[DownProc] Missing VRP baseUri or password.')
      this.updateItemStatus(item.releaseName, 'Error', 0, 'Missing VRP configuration')
      return { success: false, startExtraction: false }
    }

    const rclonePath = dependencyService.getRclonePath()
    if (!rclonePath) {
      console.error('[DownProc] Rclone path not found.')
      this.updateItemStatus(item.releaseName, 'Error', 0, 'Rclone dependency not found')
      return { success: false, startExtraction: false }
    }

    const downloadPath = item.downloadPath.endsWith(item.releaseName)
      ? item.downloadPath
      : join(item.downloadPath, item.releaseName)
    this.queueManager.updateItem(item.releaseName, { downloadPath: downloadPath })

    try {
      await fs.mkdir(downloadPath, { recursive: true })
    } catch (mkdirError: unknown) {
      let errorMsg = `Failed to create directory ${downloadPath}`
      if (mkdirError instanceof Error) {
        errorMsg = `Failed to create directory: ${mkdirError.message}`
      }
      console.error(`[DownProc] Failed to create download directory ${downloadPath}:`, mkdirError)
      this.updateItemStatus(item.releaseName, 'Error', 0, errorMsg.substring(0, 500))
      return { success: false, startExtraction: false }
    }

    // Check available disk space before starting download
    console.log(`[DownProc] Checking available disk space for ${item.releaseName}...`)
    const availableSpace = await getAvailableDiskSpace(item.downloadPath)
    const gameSizeBytes = item.size ? parseSizeToBytes(item.size) : 0
    const requiredSpace = gameSizeBytes * 2 // Double the game size for download + extraction

    if (availableSpace === null) {
      console.warn(`[DownProc] Could not determine available disk space for ${item.releaseName}`)
      // Continue anyway since we couldn't determine space
    } else if (requiredSpace > 0 && availableSpace < requiredSpace) {
      const errorMsg = `Insufficient disk space. Required: ${formatBytes(requiredSpace)}, Available: ${formatBytes(availableSpace)}`
      console.error(`[DownProc] ${errorMsg} for ${item.releaseName}`)
      this.updateItemStatus(item.releaseName, 'Error', 0, errorMsg)
      return { success: false, startExtraction: false }
    } else if (requiredSpace > 0) {
      console.log(
        `[DownProc] Disk space check passed for ${item.releaseName}. Game size: ${item.size}, Available: ${formatBytes(availableSpace)}, Required: ${formatBytes(requiredSpace)}`
      )
    } else {
      console.warn(
        `[DownProc] Could not determine game size for ${item.releaseName}, skipping disk space check`
      )
    }

    this.updateItemStatus(item.releaseName, 'Downloading', 0)

    // Check if there's an active mirror to use
    const activeMirror = await mirrorService.getActiveMirror()

    if (activeMirror) {
      console.log(`[DownProc] Using active mirror: ${activeMirror.name}`)

      // Get the config file path and remote name
      const configFilePath = mirrorService.getActiveMirrorConfigPath()
      const remoteName = mirrorService.getActiveMirrorRemoteName()

      if (configFilePath && remoteName) {
        try {
          console.log(`[DownProc] Using rclone copy with mirror: ${activeMirror.name}`)
          return await this.startRcloneCopyDownload(item, { configFilePath, remoteName })
        } catch (mirrorError: unknown) {
          console.error(
            `[DownProc] Mirror download failed for ${item.releaseName}, falling back to public endpoint:`,
            mirrorError
          )
          // Fall through to public endpoint
        }
      } else {
        console.warn(
          '[DownProc] Failed to get mirror config, falling back to public endpoint'
        )
      }
    }

    // Use public endpoint via rclone copy (no FUSE/macFUSE required)
    console.log(`[DownProc] Using rclone copy for public endpoint: ${item.releaseName}`)
    return await this.startRcloneCopyDownload(item)
  }

  // rclone copy based download (no macFUSE required)
  // Supports pause/resume via --partial-suffix and file-level skip
  public async startRcloneCopyDownload(
    item: DownloadItem,
    mirrorConfig?: { configFilePath: string; remoteName: string },
    isResume: boolean = false
  ): Promise<{ success: boolean; startExtraction: boolean; finalState?: DownloadItem }> {
    console.log(`[DownProc] ${isResume ? 'Resuming' : 'Starting'} rclone copy download for ${item.releaseName}...`)

    if (!this.vrpConfig?.baseUri || !this.vrpConfig?.password) {
      console.error('[DownProc] Missing VRP baseUri or password.')
      this.updateItemStatus(item.releaseName, 'Error', 0, 'Missing VRP configuration')
      return { success: false, startExtraction: false }
    }

    const rclonePath = dependencyService.getRclonePath()
    if (!rclonePath) {
      console.error('[DownProc] Rclone path not found.')
      this.updateItemStatus(item.releaseName, 'Error', 0, 'Rclone dependency not found')
      return { success: false, startExtraction: false }
    }

    const downloadPath = item.downloadPath.endsWith(item.releaseName)
      ? item.downloadPath
      : join(item.downloadPath, item.releaseName)
    this.queueManager.updateItem(item.releaseName, { downloadPath: downloadPath })

    try {
      await fs.mkdir(downloadPath, { recursive: true })

      // On resume, measure already-downloaded bytes so progress doesn't reset to 0%
      let baselineBytes = 0
      const resumeFloor = isResume ? (item.progress ?? 0) : 0
      if (isResume) {
        try {
          const existingFiles = await this.getFilesRecursively(downloadPath)
          for (const f of existingFiles) {
            if (!f.relativePath.endsWith('.partial')) {
              baselineBytes += f.size
            }
          }
          console.log(`[DownProc] Resume baseline: ${this.formatBytes(baselineBytes)} already downloaded for ${item.releaseName}`)
        } catch {
          // Directory may not exist yet, ignore
        }
        // Keep current progress until rclone stats arrive
        this.updateItemStatus(item.releaseName, 'Downloading', resumeFloor)
      } else {
        this.updateItemStatus(item.releaseName, 'Downloading', 0)
      }

      let source: string
      let copyArgs: string[]
      const nullConfigPath = process.platform === 'win32' ? 'NUL' : '/dev/null'

      if (mirrorConfig) {
        source = `${mirrorConfig.remoteName}:/Quest Games/${item.releaseName}`
        console.log(`[DownProc] Using mirror rclone copy: ${source}`)

        copyArgs = [
          'copy',
          source,
          downloadPath,
          '--config',
          mirrorConfig.configFilePath,
          '--no-check-certificate',
          '--stats',
          '1s',
          '--stats-log-level',
          'NOTICE',
          '--use-json-log',
          '--partial-suffix',
          '.partial',
          '--transfers',
          '4',
          '--multi-thread-streams',
          '1',
          '--low-level-retries',
          '10',
          '--retries',
          '5'
        ]
      } else {
        const gameNameHash = crypto
          .createHash('md5')
          .update(item.releaseName + '\n')
          .digest('hex')
        // Trailing slash matters: rclone's HTTP backend treats `:http:/<hash>`
        // as a file lookup and `:http:/<hash>/` as a directory listing.
        // The release is a directory of split 7z parts, so we need the slash.
        source = `:http:/${gameNameHash}/`
        console.log(`[DownProc] Using public endpoint rclone copy: ${source}`)

        copyArgs = [
          'copy',
          source,
          downloadPath,
          '--config',
          nullConfigPath,
          '--http-url',
          this.vrpConfig.baseUri!,
          '--no-check-certificate',
          '--stats',
          '1s',
          '--stats-log-level',
          'NOTICE',
          '--use-json-log',
          '--partial-suffix',
          '.partial',
          '--transfers',
          '4',
          '--multi-thread-streams',
          '1',
          '--low-level-retries',
          '10',
          '--retries',
          '5'
        ]
      }

      // Apply bandwidth limit if set
      const downloadSpeedLimit = settingsService.getDownloadSpeedLimit()
      if (downloadSpeedLimit > 0) {
        copyArgs.push('--bwlimit', `${downloadSpeedLimit}k`)
      }

      console.log(`[DownProc] Running: rclone ${copyArgs.join(' ')}`)

      const rcloneProcess = execa(rclonePath, copyArgs, {
        all: true,
        buffer: false,
        windowsHide: true
      })

      // Store download controller for cancel/pause
      this.activeDownloads.set(item.releaseName, {
        cancel: () => {
          try {
            rcloneProcess.kill('SIGTERM')
          } catch {
            // Process already exited
          }
        }
      })

      // Parse rclone JSON log output for progress
      let lastProgress = -1
      let lastSpeed = ''
      let statsCount = 0
      if (rcloneProcess.all) {
        let lineBuffer = ''
        rcloneProcess.all.on('data', (chunk: Buffer) => {
          lineBuffer += chunk.toString()
          // Split on both \n and \r — rclone may emit \r-terminated lines
          // alongside \n-terminated JSON when --progress leaks through
          const lines = lineBuffer.split(/[\r\n]+/)
          lineBuffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed[0] !== '{') continue // Fast skip non-JSON
            try {
              const parsed = JSON.parse(trimmed)
              if (parsed.stats) {
                const stats = parsed.stats
                statsCount++

                // Log first few stats for diagnostics
                if (statsCount <= 3) {
                  console.log(
                    `[DownProc] Stats #${statsCount} for ${item.releaseName}: ` +
                    `bytes=${stats.bytes}, totalBytes=${stats.totalBytes}, speed=${stats.speed}, ` +
                    `eta=${stats.eta}, transferring=${Array.isArray(stats.transferring) ? stats.transferring.length : 0} entries`
                  )
                  if (Array.isArray(stats.transferring) && stats.transferring.length > 0) {
                    const t = stats.transferring[0]
                    console.log(
                      `[DownProc]   First transfer: name=${t.name}, bytes=${t.bytes}, ` +
                      `size=${t.size}, percentage=${t.percentage}, speed=${t.speed}`
                    )
                  }
                }

                // Calculate percentage using multiple fallback strategies:
                // 1. Top-level totalBytes (best — available once directory listing completes)
                // 2. Aggregate per-transfer percentage (rclone's own per-file calculation)
                // 3. Aggregate per-transfer bytes/size (manual calculation)
                let percentage = 0
                if (stats.totalBytes > 0) {
                  // When resuming, rclone's totalBytes only reflects remaining work.
                  // Add baseline (already-downloaded) bytes for accurate overall progress.
                  const effectiveTotal = stats.totalBytes + baselineBytes
                  const effectiveBytes = stats.bytes + baselineBytes
                  percentage = Math.round((effectiveBytes / effectiveTotal) * 100)
                } else if (
                  Array.isArray(stats.transferring) &&
                  stats.transferring.length > 0
                ) {
                  // Use rclone's pre-calculated percentage per transfer
                  let weightedPct = 0
                  let totalWeight = 0
                  let manualBytes = 0
                  let manualSize = 0

                  for (const t of stats.transferring) {
                    if (typeof t.percentage === 'number' && t.percentage > 0) {
                      const weight = t.size > 0 ? t.size : 1
                      weightedPct += t.percentage * weight
                      totalWeight += weight
                    }
                    if (t.size > 0) {
                      manualSize += t.size
                      manualBytes += t.bytes || 0
                    }
                  }

                  if (totalWeight > 0) {
                    // Account for baseline: per-transfer % only covers remaining files
                    if (baselineBytes > 0 && manualSize > 0) {
                      const remainingBytes = (weightedPct / totalWeight / 100) * manualSize
                      percentage = Math.round(((baselineBytes + remainingBytes) / (baselineBytes + manualSize)) * 100)
                    } else {
                      percentage = Math.round(weightedPct / totalWeight)
                    }
                  } else if (manualSize > 0) {
                    percentage = Math.round(((manualBytes + baselineBytes) / (manualSize + baselineBytes)) * 100)
                  }
                }
                // Never go below the paused progress on resume, cap at 99 (100 set on completion)
                percentage = Math.max(resumeFloor, Math.min(99, percentage))

                // Speed: prefer top-level stats.speed, fall back to sum of transfer speeds
                let speed = stats.speed || 0
                if (speed === 0 && Array.isArray(stats.transferring)) {
                  for (const t of stats.transferring) {
                    speed += (t.speed || 0)
                  }
                }

                const eta = stats.eta ?? 0
                const formattedSpeed = this.formatSpeed(speed)

                // Update whenever progress OR speed changes
                if (percentage !== lastProgress || formattedSpeed !== lastSpeed) {
                  lastProgress = percentage
                  lastSpeed = formattedSpeed
                  this.updateItemStatus(
                    item.releaseName,
                    'Downloading',
                    percentage,
                    undefined,
                    formattedSpeed,
                    this.formatEta(eta)
                  )
                }
              }
            } catch {
              // Not JSON or not a stats line, ignore
            }
          }
        })
      } else {
        console.warn(`[DownProc] No rclone 'all' stream for ${item.releaseName} — progress tracking unavailable`)
      }

      // Wait for rclone to finish
      await rcloneProcess

      // Clean up
      this.activeDownloads.delete(item.releaseName)
      this.queueManager.updateItem(item.releaseName, { pid: undefined })

      // Verify the download completed
      const finalItem = this.queueManager.findItem(item.releaseName)
      if (!finalItem || finalItem.status !== 'Downloading') {
        console.log(
          `[DownProc] rclone copy for ${item.releaseName} finished but status is ${finalItem?.status}`
        )
        return { success: false, startExtraction: false, finalState: finalItem }
      }

      // Clean up any leftover .partial files (shouldn't exist if rclone finished successfully)
      try {
        const files = await this.getFilesRecursively(downloadPath)
        for (const file of files) {
          if (file.relativePath.endsWith('.partial')) {
            await fs.unlink(join(downloadPath, file.relativePath))
            console.log(`[DownProc] Cleaned up partial file: ${file.relativePath}`)
          }
        }
      } catch {
        // Ignore cleanup errors
      }

      console.log(`[DownProc] rclone copy download completed successfully for ${item.releaseName}`)
      this.updateItemStatus(item.releaseName, 'Downloading', 100)
      return { success: true, startExtraction: true, finalState: finalItem }
    } catch (error: unknown) {
      const isExecaError = (err: unknown): err is ExecaError =>
        typeof err === 'object' && err !== null && 'shortMessage' in err

      const currentItemState = this.queueManager.findItem(item.releaseName)
      const statusBeforeCatch = currentItemState?.status ?? 'Unknown'

      console.error(`[DownProc] rclone copy download error for ${item.releaseName}:`, error)

      if (this.activeDownloads.has(item.releaseName)) {
        this.activeDownloads.delete(item.releaseName)
        this.queueManager.updateItem(item.releaseName, { pid: undefined })
      }

      // Handle cancellation/pause: SIGTERM = exit code 143 on Unix; on Windows the exit
      // code differs, so also check if the item was intentionally paused/cancelled.
      if (
        (isExecaError(error) && (error.exitCode === 143 || error.isCanceled)) ||
        statusBeforeCatch === 'Paused' ||
        statusBeforeCatch === 'Cancelled'
      ) {
        console.log(`[DownProc] rclone copy download cancelled/paused for ${item.releaseName}`)
        return { success: false, startExtraction: false, finalState: currentItemState }
      }

      let errorMessage = 'Download failed.'
      if (isExecaError(error)) {
        errorMessage = error.shortMessage || error.message
      } else if (error instanceof Error) {
        errorMessage = error.message
      } else {
        errorMessage = String(error)
      }
      errorMessage = errorMessage.substring(0, 500)

      // Normalise ENOSPC / "no space left" that surfaces mid-download (rclone
      // writes fail after the pre-flight disk-space check passed).
      if (
        errorMessage.toLowerCase().includes('no space left') ||
        errorMessage.includes('ENOSPC') ||
        (isExecaError(error) && error.exitCode === 28)
      ) {
        const avail = await getAvailableDiskSpace(item.downloadPath).catch(() => null)
        errorMessage = `Insufficient disk space. The drive ran out of space during download.${avail !== null ? ` Available: ${formatBytes(avail)}` : ''} Free up space and retry.`
      }

      // Paused/Cancelled were already handled by the early return above, so
      // the only redundant case left to guard against is an item that was
      // already marked Error (e.g. by another step in the pipeline).
      if (statusBeforeCatch !== 'Error') {
        this.updateItemStatus(
          item.releaseName,
          'Error',
          currentItemState?.progress ?? 0,
          errorMessage
        )
      }

      return {
        success: false,
        startExtraction: false,
        finalState: this.queueManager.findItem(item.releaseName)
      }
    }
  }

  // Method to pause a download (kills rclone copy process)
  public pauseDownload(releaseName: string): void {
    console.log(`[DownProc] Pausing download for ${releaseName}...`)

    const downloadController = this.activeDownloads.get(releaseName)
    if (downloadController) {
      try {
        downloadController.cancel()
        console.log(`[DownProc] Paused download for ${releaseName}.`)
      } catch (cancelError) {
        console.error(`[DownProc] Error pausing download for ${releaseName}:`, cancelError)
      }
      this.activeDownloads.delete(releaseName)
    } else {
      console.log(`[DownProc] No active download found for ${releaseName} to pause.`)
    }

    // Update status to Paused
    const item = this.queueManager.findItem(releaseName)
    if (item) {
      const updated = this.queueManager.updateItem(releaseName, {
        status: 'Paused' as DownloadStatus,
        pid: undefined
      })
      if (updated) {
        console.log(`[DownProc] Updated status for ${releaseName} to Paused.`)
        this.debouncedEmitUpdate()
      }
    }
  }

  // Method to resume a paused download
  public async resumeDownload(
    item: DownloadItem
  ): Promise<{ success: boolean; startExtraction: boolean; finalState?: DownloadItem }> {
    console.log(`[DownProc] Resuming download for ${item.releaseName}...`)

    // Check if there's an active mirror (same logic as startDownload)
    let mirrorConfig: { configFilePath: string; remoteName: string } | undefined
    const activeMirror = await mirrorService.getActiveMirror()
    if (activeMirror) {
      const configFilePath = mirrorService.getActiveMirrorConfigPath()
      const remoteName = mirrorService.getActiveMirrorRemoteName()
      if (configFilePath && remoteName) {
        mirrorConfig = { configFilePath, remoteName }
      }
    }

    // rclone copy with --partial-suffix automatically resumes from where it left off
    return await this.startRcloneCopyDownload(item, mirrorConfig, true)
  }

  // Method to check if a download is active
  public isDownloadActive(releaseName: string): boolean {
    return this.activeDownloads.has(releaseName)
  }

  // Helper method to get all files recursively from a directory
  private async getFilesRecursively(
    dir: string,
    baseDir?: string
  ): Promise<Array<{ relativePath: string; size: number }>> {
    const files: Array<{ relativePath: string; size: number }> = []
    const currentBase = baseDir || dir

    const entries = await fsPromises.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relativePath = join(dir, entry.name)
        .replace(currentBase + '/', '')
        .replace(currentBase + '\\', '')
        .replace(currentBase, '')

      if (entry.isDirectory()) {
        const subFiles = await this.getFilesRecursively(fullPath, currentBase)
        files.push(...subFiles)
      } else {
        const stat = await fsPromises.stat(fullPath)
        files.push({
          relativePath: relativePath || entry.name,
          size: stat.size
        })
      }
    }

    return files
  }

  // Helper method to format bytes to human readable format
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  // Helper method to format speed
  private formatSpeed(bytesPerSecond: number): string {
    return `${this.formatBytes(bytesPerSecond)}/s`
  }

  // Helper method to format ETA
  private formatEta(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '--:--:--'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    }
  }
}
