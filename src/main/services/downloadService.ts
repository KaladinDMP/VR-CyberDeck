import { BrowserWindow } from 'electron'
import { promises as fs, existsSync } from 'fs'
import { join, basename } from 'path'
import SevenZip from 'node-7z'
import adbService from './adbService'
import dependencyService from './dependencyService'
import { EventEmitter } from 'events'
import { debounce } from './download/utils'
import { QueueManager } from './download/queueManager'
import { DownloadProcessor } from './download/downloadProcessor'
import { ExtractionProcessor } from './download/extractionProcessor'
import { InstallationProcessor } from './download/installationProcessor'
import { DownloadAPI, GameInfo, DownloadItem, DownloadStatus, AddToQueueResult } from '@shared/types'
import settingsService from './settingsService'
import { typedWebContentsSend } from '@shared/ipc-utils'

interface VrpConfig {
  baseUri?: string
  password?: string
}

class DownloadService extends EventEmitter implements DownloadAPI {
  private downloadsPath: string
  private isInitialized = false
  private activeCount = 0
  private debouncedEmitUpdate: () => void
  private queueManager: QueueManager
  private downloadProcessor: DownloadProcessor
  private extractionProcessor: ExtractionProcessor
  private installationProcessor: InstallationProcessor
  private adbService: typeof adbService
  private appSelectedDevice: string | null = null
  private appIsConnected: boolean = false

  constructor() {
    super()
    const downloadPath = settingsService.getDownloadPath()
    settingsService.on('download-path-changed', (path) => {
      this.setDownloadPath(path)
    })
    this.downloadsPath = downloadPath

    this.queueManager = new QueueManager()
    this.adbService = adbService
    this.debouncedEmitUpdate = debounce(this.emitUpdate.bind(this), 300)
    this.downloadProcessor = new DownloadProcessor(this.queueManager, this.debouncedEmitUpdate)
    this.extractionProcessor = new ExtractionProcessor(this.queueManager, this.debouncedEmitUpdate)
    this.installationProcessor = new InstallationProcessor(
      this.queueManager,
      this.adbService,
      this.debouncedEmitUpdate
    )
  }

  setDownloadPath(path: string): void {
    this.downloadsPath = path
  }

  setAppConnectionState(selectedDevice: string | null, isConnected: boolean): void {
    console.log(
      `[Service] App connection state updated - Device: ${selectedDevice}, Connected: ${isConnected}`
    )
    this.appSelectedDevice = selectedDevice
    this.appIsConnected = isConnected
  }

  private getTargetDeviceForInstallation(): string | null {
    console.log(
      `[Service] Checking app connection state - Device: ${this.appSelectedDevice}, Connected: ${this.appIsConnected}`
    )

    // If the app is not connected to any device, don't install
    if (!this.appIsConnected || !this.appSelectedDevice) {
      console.log('[Service] App is not connected to any device, skipping installation')
      return null
    }

    // Return the app's selected device for installation
    console.log(
      `[Service] Using app's connected device for installation: ${this.appSelectedDevice}`
    )
    return this.appSelectedDevice
  }

  async initialize(vrpConfig: VrpConfig): Promise<void> {
    if (this.isInitialized) return
    console.log('Initializing DownloadService...')

    this.downloadProcessor.setVrpConfig(vrpConfig)
    this.extractionProcessor.setVrpConfig(vrpConfig)

    await fs.mkdir(this.downloadsPath, { recursive: true })
    await this.queueManager.loadQueue()

    const changed = this.queueManager.updateAllItems(
      (item) =>
        item.status === 'Downloading' ||
        item.status === 'Extracting' ||
        item.status === 'Installing',
      {
        status: 'Queued',
        pid: undefined,
        progress: 0,
        extractProgress: undefined
      }
    )

    if (changed) {
      console.log(
        'Reset status for items from Downloading/Extracting/Installing to Queued after restart.'
      )
    }

    this.isInitialized = true
    console.log('DownloadService initialized.')
    this.emitUpdate()
    this.processQueue()
  }

  public getQueue(): Promise<DownloadItem[]> {
    return Promise.resolve(this.queueManager.getQueue())
  }

  /**
   * Inspect the destination folder for a release to figure out what state it
   * is in on disk, separate from the queue. Catches the case where a user
   * cleared the queue or downloaded the same release with a different tool.
   *
   * - 'absent'    : folder doesn't exist or is empty
   * - 'partial'   : has only rclone .partial files (resumable in-progress run)
   * - 'completed' : has at least one real (non-.partial) file
   */
  public async checkOnDiskCompletion(
    releaseName: string
  ): Promise<'absent' | 'partial' | 'completed'> {
    const folderPath = join(this.downloadsPath, releaseName)
    if (!existsSync(folderPath)) return 'absent'
    let entries: string[]
    try {
      entries = await fs.readdir(folderPath)
    } catch {
      return 'absent'
    }
    if (entries.length === 0) return 'absent'
    const hasReal = entries.some((name) => !name.endsWith('.partial'))
    return hasReal ? 'completed' : 'partial'
  }

  public addToQueue(game: GameInfo): Promise<AddToQueueResult> {
    if (!this.isInitialized) {
      console.error('DownloadService not initialized. Cannot add to queue.')
      return Promise.resolve('duplicate')
    }
    if (!game.releaseName) {
      console.error(`Cannot add game ${game.name} to queue: Missing releaseName.`)
      return Promise.resolve('duplicate')
    }

    return this.addToQueueInternal(game)
  }

  /**
   * Called from the renderer once the user picks an action in the
   * "files already exist" prompt. Bypasses the on-disk check.
   */
  public async addToQueueResolveExisting(
    game: GameInfo,
    action: 'reinstall' | 'redownload'
  ): Promise<AddToQueueResult> {
    if (!this.isInitialized || !game.releaseName) return 'duplicate'
    if (action === 'reinstall') {
      this.importExistingAsCompleted(game)
      return 'imported'
    }
    // redownload: wipe the existing folder so rclone copies into a clean dest
    const folderPath = join(this.downloadsPath, game.releaseName)
    try {
      await fs.rm(folderPath, { recursive: true, force: true })
    } catch (err) {
      console.error(`[Service] Failed to wipe ${folderPath} before redownload:`, err)
    }
    return this.addToQueueInternal(game, { skipOnDiskCheck: true })
  }

  private importExistingAsCompleted(game: GameInfo): void {
    const folderPath = join(this.downloadsPath, game.releaseName)
    const existing = this.queueManager.findItem(game.releaseName)
    if (existing) {
      this.queueManager.updateItem(game.releaseName, {
        status: 'Completed',
        progress: 100,
        extractProgress: 100,
        downloadPath: folderPath,
        error: undefined,
        gameId: game.id,
        gameName: game.name,
        packageName: game.packageName,
        thumbnailPath: game.thumbnailPath,
        size: game.size
      })
    } else {
      this.queueManager.addItem({
        gameId: game.id,
        releaseName: game.releaseName,
        packageName: game.packageName,
        gameName: game.name,
        status: 'Completed',
        progress: 100,
        extractProgress: 100,
        addedDate: Date.now(),
        thumbnailPath: game.thumbnailPath,
        downloadPath: folderPath,
        size: game.size
      })
    }
    console.log(`Imported existing folder for ${game.releaseName} as Completed.`)
    this.emitUpdate()
  }

  private async addToQueueInternal(
    game: GameInfo,
    opts: { skipOnDiskCheck?: boolean } = {}
  ): Promise<AddToQueueResult> {
    const existing = this.queueManager.findItem(game.releaseName)

    if (existing) {
      if (existing.status === 'Completed') {
        console.log(`Game ${game.releaseName} already downloaded.`)
        return 'duplicate'
      } else if (existing.status !== 'Error' && existing.status !== 'Cancelled') {
        console.log(
          `Game ${game.releaseName} is already in the queue with status: ${existing.status}.`
        )
        return 'duplicate'
      }
      console.log(`Re-adding game ${game.releaseName} after previous ${existing.status}.`)
      this.queueManager.removeItem(game.releaseName)
    }

    // On-disk check: a previous tool / earlier run / queue clear may have
    // left a complete copy on disk that the queue doesn't know about. Apply
    // the user's "When download already exists" preference.
    if (!opts.skipOnDiskCheck) {
      const diskState = await this.checkOnDiskCompletion(game.releaseName)
      if (diskState === 'completed') {
        const action = settingsService.getExistingDownloadAction()
        if (action === 'reinstall') {
          this.importExistingAsCompleted(game)
          return 'imported'
        }
        if (action === 'redownload') {
          const folderPath = join(this.downloadsPath, game.releaseName)
          try {
            await fs.rm(folderPath, { recursive: true, force: true })
          } catch (err) {
            console.error(
              `[Service] Failed to wipe ${folderPath} before auto-redownload:`,
              err
            )
          }
          // fall through to normal queueing below
        } else {
          // 'ask' — let the renderer prompt the user. We don't add anything
          // to the queue yet; the renderer follows up with
          // addToQueueResolveExisting.
          return 'needs-prompt'
        }
      }
    }

    const newItem: DownloadItem = {
      gameId: game.id,
      releaseName: game.releaseName,
      packageName: game.packageName,
      gameName: game.name,
      status: 'Queued',
      progress: 0,
      addedDate: Date.now(),
      thumbnailPath: game.thumbnailPath,
      downloadPath: this.downloadsPath,
      size: game.size
    }
    this.queueManager.addItem(newItem)
    console.log(`Added ${game.releaseName} to download queue.`)
    this.emitUpdate()
    this.processQueue()
    return 'added'
  }

  private cancelActiveItem(releaseName: string, item: DownloadItem): void {
    if (item.status === 'Downloading') {
      console.log(`[Service] Requesting cancel download for ${releaseName}`)
      this.downloadProcessor.cancelDownload(releaseName, 'Cancelled')
    } else if (item.status === 'Extracting') {
      console.log(`[Service] Requesting cancel extraction for ${releaseName}`)
      this.extractionProcessor.cancelExtraction(releaseName)
      const updated = this.queueManager.updateItem(releaseName, {
        status: 'Cancelled',
        extractProgress: 0,
        pid: undefined,
        error: undefined
      })
      if (updated) this.debouncedEmitUpdate()
    }
  }

  public async removeFromQueue(releaseName: string): Promise<void> {
    const item = this.queueManager.findItem(releaseName)
    if (!item) return
    this.cancelActiveItem(releaseName, item)
    await this.deleteDownloadedFiles(releaseName)
    const removed = this.queueManager.removeItem(releaseName)
    if (removed) {
      console.log(`[Service] Removed ${releaseName} from queue (status: ${item.status}).`)
      this.emitUpdate()
    }
  }

  public async removeFromQueueOnly(releaseName: string): Promise<void> {
    const item = this.queueManager.findItem(releaseName)
    if (!item) return
    this.cancelActiveItem(releaseName, item)
    const removed = this.queueManager.removeItem(releaseName)
    if (removed) {
      console.log(`[Service] Removed ${releaseName} from queue without deleting files (status: ${item.status}).`)
      this.emitUpdate()
    }
  }

  private async processQueue(): Promise<void> {
    const maxConcurrent = settingsService.getMaxConcurrentDownloads()
    // Launch as many concurrent pipelines as allowed
    while (this.activeCount < maxConcurrent) {
      const nextItem = this.queueManager.findNextQueuedItem()
      if (!nextItem) {
        if (this.activeCount === 0) {
          console.log('[Service ProcessQueue] No queued items and no active operations')
        }
        return
      }

      // CRITICAL: Change status from 'Queued' IMMEDIATELY before the async pipeline starts,
      // so the next loop iteration of findNextQueuedItem() won't pick the same item again.
      this.queueManager.updateItem(nextItem.releaseName, { status: 'Downloading', progress: 0 })

      // Mark as active immediately so the next loop iteration won't pick it again
      this.activeCount++
      console.log(
        `[Service ProcessQueue] Processing: ${nextItem.releaseName} (active: ${this.activeCount}/${maxConcurrent})`
      )

      // Fire off the pipeline without awaiting — runs concurrently
      this.runPipeline(nextItem).finally(() => {
        this.activeCount--
        console.log(
          `[Service ProcessQueue] Finished pipeline for ${nextItem.releaseName} (active: ${this.activeCount})`
        )
        // Try to fill the freed slot
        this.processQueue()
      })
    }
  }

  private async runPipeline(nextItem: DownloadItem): Promise<void> {
    const targetDeviceId = this.getTargetDeviceForInstallation()

    try {
      const downloadResult = await this.downloadProcessor.startDownload(nextItem)
      if (!downloadResult.success) {
        console.log(
          `[Service ProcessQueue] Download failed/cancelled for ${nextItem.releaseName}. Status: ${downloadResult.finalState?.status}`
        )
        return
      }
      const itemAfterDownload = downloadResult.finalState
      if (!itemAfterDownload) {
        console.log(
          `[Service ProcessQueue] Download successful but no final state for ${nextItem.releaseName}.`
        )
        return
      }
      if (!downloadResult.startExtraction) {
        console.log(
          `[Service ProcessQueue] Download successful but extraction flag not set for ${nextItem.releaseName}.`
        )
        return
      }

      console.log(
        `[Service ProcessQueue] Download successful for ${itemAfterDownload.releaseName}. Starting extraction...`
      )
      const extractionSuccess = await this.extractionProcessor.startExtraction(itemAfterDownload)
      if (!extractionSuccess) {
        console.log(
          `[Service ProcessQueue] Extraction failed or was cancelled for ${itemAfterDownload.releaseName}.`
        )
        return
      }
      const itemAfterExtraction = this.queueManager.findItem(itemAfterDownload.releaseName)
      if (!itemAfterExtraction || itemAfterExtraction.status !== 'Completed') {
        console.warn(
          `[Service ProcessQueue] Extraction reported success for ${itemAfterDownload.releaseName}, but item status is now ${itemAfterExtraction?.status}. Skipping installation.`
        )
        return
      }

      // Re-check connection state before installation (device might have disconnected during extraction)
      const finalTargetDeviceId = this.getTargetDeviceForInstallation()
      if (!finalTargetDeviceId) {
        console.warn(
          `[Service ProcessQueue] Extraction successful for ${itemAfterExtraction.releaseName}, but app is no longer connected to a device. Skipping installation.`
        )
        return
      }

      if (targetDeviceId && targetDeviceId !== finalTargetDeviceId) {
        console.warn(
          `[Service ProcessQueue] Target device changed during processing. Was: ${targetDeviceId}, Now: ${finalTargetDeviceId}. Skipping installation.`
        )
        return
      }

      console.log(
        `[Service ProcessQueue] Extraction successful for ${itemAfterExtraction.releaseName}. Queuing installation on ${finalTargetDeviceId}...`
      )
      const installStartTime = Date.now()
      const installationSuccess = await this.installationProcessor.startInstallation(
        itemAfterExtraction,
        finalTargetDeviceId
      )
      const installDuration = ((Date.now() - installStartTime) / 1000).toFixed(1)
      if (installationSuccess) {
        console.log(
          `[Service ProcessQueue] Installation completed for ${itemAfterExtraction.releaseName} in ${installDuration}s`
        )
        // Emit event on successful installation
        this.emit('installation:success', finalTargetDeviceId)
      } else {
        console.error(
          `[Service ProcessQueue] Installation failed for ${itemAfterExtraction.releaseName} after ${installDuration}s`
        )
      }
    } catch (error) {
      console.error(
        `[Service ProcessQueue] UNEXPECTED error in main processing loop for ${nextItem.releaseName}:`,
        error
      )
      const currentItem = this.queueManager.findItem(nextItem.releaseName)
      this.updateItemStatus(
        nextItem.releaseName,
        'Error',
        currentItem?.progress ?? 0,
        'Unexpected processing error',
        undefined,
        undefined,
        currentItem?.extractProgress
      )
    }
  }

  // Resume pipeline: same as runPipeline but uses resumeDownload instead of startDownload
  private async runResumePipeline(nextItem: DownloadItem): Promise<void> {
    const targetDeviceId = this.getTargetDeviceForInstallation()

    try {
      const downloadResult = await this.downloadProcessor.resumeDownload(nextItem)
      if (!downloadResult.success) {
        console.log(
          `[Service ResumeQueue] Download failed/cancelled for ${nextItem.releaseName}. Status: ${downloadResult.finalState?.status}`
        )
        return
      }
      const itemAfterDownload = downloadResult.finalState
      if (!itemAfterDownload || !downloadResult.startExtraction) {
        console.log(
          `[Service ResumeQueue] Download done but extraction not needed for ${nextItem.releaseName}.`
        )
        return
      }

      console.log(
        `[Service ResumeQueue] Download successful for ${itemAfterDownload.releaseName}. Starting extraction...`
      )
      const extractionSuccess = await this.extractionProcessor.startExtraction(itemAfterDownload)
      if (!extractionSuccess) {
        console.log(
          `[Service ResumeQueue] Extraction failed or was cancelled for ${itemAfterDownload.releaseName}.`
        )
        return
      }
      const itemAfterExtraction = this.queueManager.findItem(itemAfterDownload.releaseName)
      if (!itemAfterExtraction || itemAfterExtraction.status !== 'Completed') {
        console.warn(
          `[Service ResumeQueue] Extraction reported success but status is ${itemAfterExtraction?.status}. Skipping installation.`
        )
        return
      }

      const finalTargetDeviceId = this.getTargetDeviceForInstallation()
      if (!finalTargetDeviceId) {
        console.warn(
          `[Service ResumeQueue] No connected device after extraction for ${itemAfterExtraction.releaseName}. Skipping installation.`
        )
        return
      }

      if (targetDeviceId && targetDeviceId !== finalTargetDeviceId) {
        console.warn(
          `[Service ResumeQueue] Target device changed. Skipping installation for ${itemAfterExtraction.releaseName}.`
        )
        return
      }

      console.log(
        `[Service ResumeQueue] Starting installation for ${itemAfterExtraction.releaseName} on ${finalTargetDeviceId}...`
      )
      const installStartTime = Date.now()
      const installationSuccess = await this.installationProcessor.startInstallation(
        itemAfterExtraction,
        finalTargetDeviceId
      )
      const installDuration = ((Date.now() - installStartTime) / 1000).toFixed(1)
      if (installationSuccess) {
        console.log(
          `[Service ResumeQueue] Installation completed for ${itemAfterExtraction.releaseName} in ${installDuration}s`
        )
        this.emit('installation:success', finalTargetDeviceId)
      } else {
        console.error(
          `[Service ResumeQueue] Installation failed for ${itemAfterExtraction.releaseName} after ${installDuration}s`
        )
      }
    } catch (error) {
      console.error(
        `[Service ResumeQueue] UNEXPECTED error for ${nextItem.releaseName}:`,
        error
      )
      const currentItem = this.queueManager.findItem(nextItem.releaseName)
      this.updateItemStatus(
        nextItem.releaseName,
        'Error',
        currentItem?.progress ?? 0,
        'Unexpected processing error',
        undefined,
        undefined,
        currentItem?.extractProgress
      )
    }
  }

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
    } else if (
      status !== 'Extracting' &&
      status !== 'Completed' &&
      status !== 'Installing' &&
      status !== 'InstallError'
    ) {
      updates.extractProgress = undefined
    }
    if (status !== 'Downloading') {
      updates.speed = undefined
      updates.eta = undefined
    }
    if (status !== 'Downloading' && status !== 'Extracting' && status !== 'Installing') {
      updates.pid = undefined
    }
    if (status !== 'Error' && status !== 'InstallError') {
      updates.error = undefined
    }

    const updated = this.queueManager.updateItem(releaseName, updates)
    if (updated) {
      this.debouncedEmitUpdate()
    } else {
      console.warn(`[Service updateItemStatus] Failed update for non-existent item: ${releaseName}`)
    }
  }

  private emitUpdate(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow && !mainWindow.isDestroyed()) {
      typedWebContentsSend.send(mainWindow, 'download:queue-updated', this.queueManager.getQueue())
    }
  }

  public cancelUserRequest(releaseName: string): Promise<void> {
    const item = this.queueManager.findItem(releaseName)
    if (!item) {
      console.warn(`[Service cancelUserRequest] Cannot cancel ${releaseName} - not found.`)
      return Promise.resolve()
    }

    console.log(
      `[Service cancelUserRequest] User requesting cancel for ${releaseName}, status: ${item.status}, active: ${this.activeCount}`
    )

    if (item.status === 'Downloading' || item.status === 'Queued') {
      this.downloadProcessor.cancelDownload(releaseName, 'Cancelled')
      // The pipeline's .finally() will decrement activeCount and call processQueue()
    } else if (item.status === 'Extracting') {
      this.extractionProcessor.cancelExtraction(releaseName)
      const updated = this.queueManager.updateItem(releaseName, {
        status: 'Cancelled',
        extractProgress: 0,
        pid: undefined,
        error: undefined
      })
      if (updated) this.debouncedEmitUpdate()
      // The pipeline's .finally() will decrement activeCount and call processQueue()
    } else if (item.status === 'Installing') {
      console.warn(
        `[Service cancelUserRequest] Cancellation requested for ${releaseName} during 'Installing' state - Not supported.`
      )
    } else {
      console.warn(
        `[Service cancelUserRequest] Cannot cancel ${releaseName} - status: ${item.status}`
      )
    }

    return Promise.resolve()
  }

  public retryDownload(releaseName: string): Promise<void> {
    const item = this.queueManager.findItem(releaseName)
    if (
      item &&
      (item.status === 'Cancelled' || item.status === 'Error' || item.status === 'InstallError')
    ) {
      console.log(`[Service] Retrying download: ${releaseName}`)

      if (this.downloadProcessor.isDownloadActive(releaseName)) {
        console.warn(
          `[Service Retry] Retrying item ${releaseName} with active download - cancelling first.`
        )
        this.downloadProcessor.cancelDownload(releaseName, 'Error', 'Cancelled before retry')
      }
      if (this.extractionProcessor.isExtractionActive(releaseName)) {
        console.warn(
          `[Service Retry] Retrying item ${releaseName} with active extraction - cancelling first.`
        )
        this.extractionProcessor.cancelExtraction(releaseName)
      }

      const updated = this.queueManager.updateItem(releaseName, {
        status: 'Queued',
        downloadPath: this.downloadsPath,
        progress: 0,
        extractProgress: undefined,
        error: undefined,
        pid: undefined,
        speed: undefined,
        eta: undefined
      })
      if (updated) {
        this.emitUpdate()
        this.processQueue()
      } else {
        console.warn(`[Service Retry] Failed to update ${releaseName} for retry.`)
      }
    } else {
      console.warn(`[Service Retry] Cannot retry ${releaseName} - status: ${item?.status}`)
    }
    return Promise.resolve()
  }

  public pauseDownload(releaseName: string): void {
    const item = this.queueManager.findItem(releaseName)
    if (item) {
      this.downloadProcessor.pauseDownload(releaseName)
    }
  }

  public resumeDownload(releaseName: string): void {
    const item = this.queueManager.findItem(releaseName)
    if (!item) return

    // Track as active pipeline so concurrent limits are respected
    this.activeCount++
    console.log(
      `[Service] Resuming pipeline for ${releaseName} (active: ${this.activeCount}/${settingsService.getMaxConcurrentDownloads()})`
    )

    // Run the full pipeline (download → extraction → installation) via resume path
    this.runResumePipeline(item).finally(() => {
      this.activeCount--
      console.log(
        `[Service] Finished resume pipeline for ${releaseName} (active: ${this.activeCount}/${settingsService.getMaxConcurrentDownloads()})`
      )
      this.processQueue()
    })
  }

  public async deleteDownloadedFiles(releaseName: string): Promise<boolean> {
    const item = this.queueManager.findItem(releaseName)
    if (!item) {
      console.warn(`Cannot delete files for ${releaseName}: Not found.`)
      return Promise.resolve(false)
    }

    const downloadPath = item.downloadPath

    if (!downloadPath) {
      console.log(`No download path for ${releaseName}, removing item.`)
      const removed = this.queueManager.removeItem(releaseName)
      if (removed) this.emitUpdate()
      return Promise.resolve(true)
    }

    if (!existsSync(downloadPath)) {
      console.log(`Path not found for ${releaseName}: ${downloadPath}. Removing item.`)
      const removed = this.queueManager.removeItem(releaseName)
      if (removed) this.emitUpdate()
      return Promise.resolve(true)
    }

    console.log(`Deleting directory: ${downloadPath} for ${releaseName}...`)
    try {
      await fs.rm(downloadPath, { recursive: true, force: true })
      console.log(`Deleted directory ${downloadPath}.`)
      const removed = this.queueManager.removeItem(releaseName)
      if (removed) this.emitUpdate()
      return true
    } catch (error: unknown) {
      console.error(`Error deleting ${downloadPath} for ${releaseName}:`, error)
      let errorMsg = 'Failed to delete files.'
      if (error instanceof Error) {
        errorMsg = `Failed to delete files: ${error.message}`.substring(0, 200)
      } else {
        errorMsg = `Failed to delete files: ${String(error)}`.substring(0, 200)
      }
      const updated = this.queueManager.updateItem(releaseName, { error: errorMsg })
      if (updated) this.emitUpdate()
      return Promise.resolve(false)
    }
  }

  public async scanDownloadFolder(): Promise<{ added: number; pruned: number }> {
    let subdirs: string[] = []
    try {
      const dirents = await fs.readdir(this.downloadsPath, { withFileTypes: true })
      subdirs = dirents.filter((d) => d.isDirectory()).map((d) => d.name)
    } catch {
      return { added: 0, pruned: 0 }
    }

    const queue = this.queueManager.getQueue()
    const queueMap = new Map(queue.map((item) => [item.releaseName, item]))
    let added = 0
    let pruned = 0

    for (const dirName of subdirs) {
      const existing = queueMap.get(dirName)
      const folderPath = join(this.downloadsPath, dirName)
      if (!existing) {
        this.queueManager.addItem({
          gameId: dirName,
          releaseName: dirName,
          packageName: '',
          gameName: dirName,
          status: 'Completed',
          progress: 100,
          extractProgress: 100,
          addedDate: Date.now(),
          downloadPath: folderPath
        })
        added++
      } else if (
        existing.status === 'Cancelled' ||
        existing.status === 'Error' ||
        existing.status === 'InstallError'
      ) {
        this.queueManager.updateItem(dirName, {
          status: 'Completed',
          progress: 100,
          extractProgress: 100,
          downloadPath: folderPath,
          error: undefined
        })
        added++
      }
    }

    for (const item of queue) {
      if (
        item.status === 'Completed' ||
        item.status === 'Cancelled' ||
        item.status === 'Error' ||
        item.status === 'InstallError'
      ) {
        const folderPath = join(this.downloadsPath, item.releaseName)
        if (!existsSync(folderPath)) {
          this.queueManager.removeItem(item.releaseName)
          pruned++
        }
      }
    }

    if (added > 0 || pruned > 0) this.emitUpdate()
    console.log(`[Service scanDownloadFolder] added=${added} pruned=${pruned}`)
    return { added, pruned }
  }

  public async installFromCompleted(releaseName: string, deviceId: string): Promise<void> {
    console.log(`[Service] Request to install completed item: ${releaseName} on ${deviceId}`)
    const item = this.queueManager.findItem(releaseName)

    if (!item) {
      console.error(`[Service installFromCompleted] Item not found: ${releaseName}`)
      throw new Error(`Item not found: ${releaseName}`)
    }

    if (item.status !== 'Completed') {
      console.error(
        `[Service installFromCompleted] Item ${releaseName} has status ${item.status}, not 'Completed'. Cannot start installation.`
      )
      throw new Error(`Item ${releaseName} is not in 'Completed' state.`)
    }

    if (this.activeCount >= settingsService.getMaxConcurrentDownloads()) {
      console.warn(
        `[Service installFromCompleted] Queue is at max concurrency (${this.activeCount}/${settingsService.getMaxConcurrentDownloads()}). Installation for ${releaseName} will be handled when a slot opens.`
      )
      // Optionally, we could queue this specific action, but for now, let the main loop handle it
      // Or force a status change back to Queued? Seems counter-intuitive.
      // Let's just rely on the check within startInstallation to set status to Installing
      // and proceed if not already processing.
      // throw new Error('Queue is busy') // Maybe throw error?
      return // Don't throw, just log and return. Main loop might pick it up later?
    }

    // Check if the app is connected to the target device
    const targetDeviceForInstall = this.getTargetDeviceForInstallation()
    if (!targetDeviceForInstall) {
      console.error(
        `[Service installFromCompleted] App is not connected to any device. Cannot install ${releaseName}.`
      )
      throw new Error('App is not connected to any device.')
    }

    if (targetDeviceForInstall !== deviceId) {
      console.error(
        `[Service installFromCompleted] App is connected to ${targetDeviceForInstall} but installation requested for ${deviceId}.`
      )
      throw new Error(`App is connected to a different device (${targetDeviceForInstall}).`)
    }

    // Check if the target device is still connected and authorized at the ADB level
    try {
      const devices = await this.adbService.listDevices()
      const targetDevice = devices.find((d) => d.id === deviceId && d.type === 'device')
      if (!targetDevice) {
        console.error(
          `[Service installFromCompleted] Target device ${deviceId} not found or not authorized at ADB level.`
        )
        throw new Error(`Target device ${deviceId} not found or not authorized.`)
      }
    } catch (err) {
      console.error(
        `[Service installFromCompleted] Error verifying target device ${deviceId}:`,
        err
      )
      throw new Error(`Failed to verify target device ${deviceId}.`)
    }

    console.log(
      `[Service installFromCompleted] Triggering installation processor for ${releaseName} on ${deviceId}...`
    )

    // Directly trigger the installation processor
    // The installationProcessor will handle setting the status to 'Installing'
    try {
      const success = await this.installationProcessor.startInstallation(item, deviceId)
      // Log based on success
      if (success) {
        console.log(
          `[Service installFromCompleted] Installation process initiated and reported success for ${releaseName}.`
        )
        // Emit event on successful installation
        this.emit('installation:success', deviceId)
      } else {
        console.warn(
          `[Service installFromCompleted] Installation process initiated for ${releaseName} but reported failure.`
        )
      }
      // Note: We don't await the full completion here, just the initiation.
      // The status updates will come via the processor and emitUpdate.
    } catch (error) {
      console.error(
        `[Service installFromCompleted] Error initiating installation for ${releaseName}:`,
        error
      )
      // Attempt to set error status if possible
      this.updateItemStatus(
        releaseName,
        'InstallError',
        item.progress ?? 100, // Keep progress, default to 100 if undefined
        `Failed to start installation: ${error instanceof Error ? error.message : String(error)}`.substring(
          0,
          200
        ),
        undefined, // speed - not applicable
        undefined, // eta - not applicable
        item.extractProgress ?? 100 // Keep extract progress, default to 100 if undefined
      )
      // Re-throw or just log?
      throw error // Re-throw so the IPC handler logs it
    }
  }

  public async installManualFile(filePath: string, deviceId: string): Promise<boolean> {
    console.log(`[Service] Manual install requested for ${filePath} on device ${deviceId}`)

    // Check if the app is connected to the target device
    const targetDeviceForInstall = this.getTargetDeviceForInstallation()
    if (!targetDeviceForInstall) {
      console.error(
        `[Service installManualFile] App is not connected to any device. Cannot install ${filePath}.`
      )
      return false
    }

    if (targetDeviceForInstall !== deviceId) {
      console.error(
        `[Service installManualFile] App is connected to ${targetDeviceForInstall} but installation requested for ${deviceId}.`
      )
      return false
    }

    // Check if the target device is still connected and authorized at the ADB level
    try {
      const devices = await this.adbService.listDevices()
      const targetDevice = devices.find((d) => d.id === deviceId && d.type === 'device')
      if (!targetDevice) {
        console.error(
          `[Service installManualFile] Target device ${deviceId} not found or not authorized at ADB level.`
        )
        return false
      }
    } catch (err) {
      console.error(`[Service installManualFile] Error verifying target device ${deviceId}:`, err)
      return false
    }

    // Check if the file/folder exists
    if (!existsSync(filePath)) {
      console.error(`[Service installManualFile] File/folder not found: ${filePath}`)
      return false
    }

    try {
      const stats = await fs.stat(filePath)

      if (stats.isFile() && filePath.toLowerCase().endsWith('.apk')) {
        // Single APK file installation
        console.log(`[Service installManualFile] Installing single APK: ${filePath}`)
        const success = await this.adbService.installPackage(deviceId, filePath, {
          flags: ['-r', '-g']
        })
        if (success) {
          console.log(`[Service installManualFile] Successfully installed APK: ${filePath}`)
          this.emit('installation:success', deviceId)
        }
        return success
      } else if (stats.isDirectory()) {
        // Folder installation - create a temporary DownloadItem to use existing installation logic
        console.log(`[Service installManualFile] Installing folder: ${filePath}`)

        // Generate a unique identifier for this manual installation
        const manualId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

        // Try to extract package name from folder structure if possible
        let packageName = ''
        try {
          const folderContents = await fs.readdir(filePath)
          const apkFiles = folderContents.filter((f) => f.toLowerCase().endsWith('.apk'))
          if (apkFiles.length > 0) {
            // Look for potential package directory (common pattern in extracted games)
            const potentialPackageDirs = folderContents.filter((item) => {
              // Common package name patterns
              return item.includes('.') && !item.includes(' ') && item.length > 5
            })
            if (potentialPackageDirs.length === 1) {
              packageName = potentialPackageDirs[0]
            }
          }
        } catch (error) {
          console.log(`[Service installManualFile] Could not analyze folder structure: ${error}`)
        }

        // Create a temporary DownloadItem
        const tempItem: DownloadItem = {
          gameId: manualId,
          releaseName: manualId,
          packageName: packageName,
          gameName: `Manual Install: ${filePath.split(/[/\\]/).pop()}`,
          status: 'Completed',
          progress: 100,
          extractProgress: 100,
          addedDate: Date.now(),
          downloadPath: filePath
        }

        // Use the installation processor to handle the folder
        const success = await this.installationProcessor.startInstallation(tempItem, deviceId)
        if (success) {
          console.log(`[Service installManualFile] Successfully installed folder: ${filePath}`)
          this.emit('installation:success', deviceId)
        }
        return success
      } else if (stats.isFile() && filePath.toLowerCase().endsWith('.zip')) {
        // ZIP installation - extract to temp dir then run through installationProcessor
        // (which checks for install.txt and falls back to standard APK+OBB install)
        console.log(`[Service installManualFile] Installing from ZIP: ${filePath}`)

        const sevenZipPath = dependencyService.get7zPath()
        if (!sevenZipPath) {
          console.error('[Service installManualFile] 7zip not found, cannot extract ZIP')
          return false
        }

        const tmpDir = join(this.downloadsPath, `manual_install_${Date.now()}`)
        await fs.mkdir(tmpDir, { recursive: true })

        try {
          await new Promise<void>((resolve, reject) => {
            const stream = SevenZip.extractFull(filePath, tmpDir, { $bin: sevenZipPath })
            stream.on('end', resolve)
            stream.on('error', reject)
          })

          const manualId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          const tempItem: DownloadItem = {
            gameId: manualId,
            releaseName: manualId,
            packageName: '',
            gameName: `Manual Install: ${basename(filePath, '.zip')}`,
            status: 'Completed',
            progress: 100,
            extractProgress: 100,
            addedDate: Date.now(),
            downloadPath: tmpDir
          }

          const success = await this.installationProcessor.startInstallation(tempItem, deviceId)
          if (success) {
            console.log(`[Service installManualFile] Successfully installed from ZIP: ${filePath}`)
            this.emit('installation:success', deviceId)
          }
          return success
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
        }
      } else {
        console.error(`[Service installManualFile] Unsupported file type: ${filePath}`)
        return false
      }
    } catch (error) {
      console.error(
        `[Service installManualFile] Error during manual installation of ${filePath}:`,
        error
      )
      return false
    }
  }

  public async copyObbFolder(folderPath: string, deviceId: string): Promise<boolean> {
    console.log(`[Service] OBB folder copy requested for ${folderPath} on device ${deviceId}`)

    // Check if the app is connected to the target device
    const targetDeviceForInstall = this.getTargetDeviceForInstallation()
    if (!targetDeviceForInstall) {
      console.error(
        `[Service copyObbFolder] App is not connected to any device. Cannot copy OBB folder ${folderPath}.`
      )
      return false
    }

    if (targetDeviceForInstall !== deviceId) {
      console.error(
        `[Service copyObbFolder] App is connected to ${targetDeviceForInstall} but OBB copy requested for ${deviceId}.`
      )
      return false
    }

    // Check if the target device is still connected and authorized at the ADB level
    try {
      const devices = await this.adbService.listDevices()
      const targetDevice = devices.find((d) => d.id === deviceId && d.type === 'device')
      if (!targetDevice) {
        console.error(
          `[Service copyObbFolder] Target device ${deviceId} not found or not authorized at ADB level.`
        )
        return false
      }
    } catch (err) {
      console.error(`[Service copyObbFolder] Error verifying target device ${deviceId}:`, err)
      return false
    }

    // Check if the folder exists
    if (!existsSync(folderPath)) {
      console.error(`[Service copyObbFolder] Folder not found: ${folderPath}`)
      return false
    }

    try {
      const stats = await fs.stat(folderPath)
      if (!stats.isDirectory()) {
        console.error(`[Service copyObbFolder] Path is not a directory: ${folderPath}`)
        return false
      }

      // Get the folder name to use as the target directory name in OBB
      const folderName = folderPath.split(/[/\\]/).pop()
      if (!folderName) {
        console.error(
          `[Service copyObbFolder] Could not extract folder name from path: ${folderPath}`
        )
        return false
      }

      // Ensure the OBB base directory exists on the device
      const obbBasePath = '/sdcard/Android/obb'
      const targetObbPath = `${obbBasePath}/${folderName}`

      console.log(`[Service copyObbFolder] Creating OBB base directory: ${obbBasePath}`)
      try {
        await this.adbService.runShellCommand(deviceId, `mkdir -p "${obbBasePath}"`)
      } catch (mkdirError) {
        console.warn(
          `[Service copyObbFolder] Could not ensure OBB base directory exists (may already exist):`,
          mkdirError
        )
      }

      // Copy the entire folder to the OBB directory
      console.log(`[Service copyObbFolder] Copying folder ${folderPath} to ${targetObbPath}`)
      const success = await this.adbService.pushFileOrFolder(deviceId, folderPath, targetObbPath)

      if (success) {
        console.log(`[Service copyObbFolder] Successfully copied OBB folder to ${targetObbPath}`)
      } else {
        console.error(`[Service copyObbFolder] Failed to copy OBB folder to ${targetObbPath}`)
      }

      return success
    } catch (error) {
      console.error(`[Service copyObbFolder] Error during OBB folder copy of ${folderPath}:`, error)
      return false
    }
  }
}

export default new DownloadService()
