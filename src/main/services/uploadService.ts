import { app, BrowserWindow } from 'electron'
import { promises as fs, existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { hostname, userInfo } from 'os'
import { EventEmitter } from 'events'
import crypto from 'crypto'
import { execa } from 'execa'
import adbService from './adbService'
import dependencyService from './dependencyService'
import gameService from './gameService'
import {
  ServiceStatus,
  UploadPreparationProgress,
  UploadStatus,
  UploadItem,
  LocalUploadError
} from '@shared/types'
import { typedWebContentsSend } from '@shared/ipc-utils'
import SevenZip from 'node-7z'

// Enum for stages to track overall progress
enum UploadStage {
  Setup = 0,
  PullingApk = 1,
  AnalyzingObb = 2,
  PullingObb = 3,
  CreatingMetadata = 4,
  Compressing = 5,
  Uploading = 6,
  Complete = 7
}

class UploadService extends EventEmitter {
  private status: ServiceStatus = 'NOT_INITIALIZED'
  private uploadsBasePath: string
  private configFilePath: string
  private activeUpload: ReturnType<typeof execa> | null = null
  private activeCompression: SevenZip.ZipStream | null = null
  private isProcessing = false
  private uploadQueue: UploadItem[] = []

  constructor() {
    super()
    this.uploadsBasePath = join(app.getPath('userData'), 'uploads')
    // upload.config is written by the VRP sync into vrp-data/.meta after first connect
    this.configFilePath = join(app.getPath('userData'), 'vrp-data', '.meta', 'upload.config')
  }

  public async initialize(): Promise<ServiceStatus> {
    if (this.status === 'INITIALIZED') return 'INITIALIZED'

    console.log('Initializing UploadService...')

    try {
      await fs.mkdir(this.uploadsBasePath, { recursive: true })
      this.status = 'INITIALIZED'
      console.log('UploadService initialized.')
      return 'INITIALIZED'
    } catch (error) {
      console.error('Failed to initialize UploadService:', error)
      this.status = 'ERROR'
      return 'ERROR'
    }
  }

  /**
   * Create a SHA256 hash from the device serial
   * This creates a unique but reproducible ID for the device
   */
  private generateHWID(deviceSerial: string): string {
    return crypto.createHash('sha256').update(deviceSerial).digest('hex')
  }

  private emitProgress(packageName: string, stage: string, progress: number): void {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow && !mainWindow.isDestroyed()) {
      const progressData: UploadPreparationProgress = {
        packageName,
        stage,
        progress
      }
      typedWebContentsSend.send(mainWindow, 'upload:progress', progressData)

      // Update queue item with progress info
      this.updateItemStatus(packageName, undefined, progress, stage)
    }
  }

  private updateProgress(packageName: string, stage: UploadStage, stageProgress: number): void {
    // Map stage to a descriptive name
    let stageName = 'Preparing upload'
    switch (stage) {
      case UploadStage.Setup:
        stageName = 'Setting up'
        break
      case UploadStage.PullingApk:
        stageName = 'Pulling APK'
        break
      case UploadStage.AnalyzingObb:
        stageName = 'Analyzing OBB content'
        break
      case UploadStage.PullingObb:
        stageName = 'Pulling OBB files'
        break
      case UploadStage.CreatingMetadata:
        stageName = 'Creating metadata'
        break
      case UploadStage.Compressing:
        stageName = 'Creating zip archive'
        break
      case UploadStage.Uploading:
        stageName = 'Uploading to server'
        break
      case UploadStage.Complete:
        stageName = 'Complete'
        break
    }

    this.emitProgress(packageName, stageName, stageProgress)
  }

  public getQueue(): UploadItem[] {
    return [...this.uploadQueue]
  }

  private findItemIndex(packageName: string): number {
    return this.uploadQueue.findIndex((item) => item.packageName === packageName)
  }

  private findItem(packageName: string): UploadItem | undefined {
    return this.uploadQueue.find((item) => item.packageName === packageName)
  }

  private updateItemStatus(
    packageName: string,
    status?: UploadStatus,
    progress?: number,
    stage?: string,
    error?: string,
    zipPath?: string
  ): void {
    const index = this.findItemIndex(packageName)
    if (index === -1) {
      console.warn(`[UploadService] Cannot update status for non-existent item: ${packageName}`)
      return
    }

    const updates: Partial<UploadItem> = {}
    if (status !== undefined) updates.status = status
    if (progress !== undefined) updates.progress = progress
    if (stage !== undefined) updates.stage = stage
    if (error !== undefined) updates.error = error
    if (zipPath !== undefined) updates.zipPath = zipPath

    this.uploadQueue[index] = { ...this.uploadQueue[index], ...updates }

    // Emit queue update
    this.emitQueueUpdated()
  }

  private emitQueueUpdated(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow && !mainWindow.isDestroyed()) {
      typedWebContentsSend.send(mainWindow, 'upload:queue-updated', this.uploadQueue)
    }
  }

  public addToQueue(
    packageName: string,
    gameName: string,
    versionCode: number,
    deviceId: string
  ): boolean {
    // Check if item is in the blacklist with this or lower version
    if (gameService.isGameBlacklisted(packageName, versionCode)) {
      console.log(
        `[UploadService] ${packageName} v${versionCode} is in the blacklist or has a newer version already uploaded.`
      )
      return false
    }

    // Check if item already exists in queue
    const existingItem = this.findItem(packageName)
    if (existingItem) {
      if (existingItem.status === 'Completed') {
        console.log(`[UploadService] ${packageName} already uploaded successfully.`)
        return false
      } else if (existingItem.status !== 'Error' && existingItem.status !== 'Cancelled') {
        console.log(
          `[UploadService] ${packageName} is already in the queue with status: ${existingItem.status}`
        )
        return false
      }

      // Remove previous item if it was in error or cancelled
      this.uploadQueue = this.uploadQueue.filter((item) => item.packageName !== packageName)
    }

    // Add new item to queue
    const newItem: UploadItem = {
      packageName,
      gameName,
      versionCode,
      deviceId,
      status: 'Queued',
      progress: 0,
      addedDate: Date.now()
    }

    this.uploadQueue.push(newItem)
    console.log(`[UploadService] Added ${packageName} v${versionCode} to upload queue.`)
    this.emitQueueUpdated()

    // Start processing the queue if we're not already
    if (!this.isProcessing) {
      this.processQueue()
    }

    return true
  }

  public removeFromQueue(packageName: string): void {
    const item = this.findItem(packageName)
    if (!item) return

    if (item.status === 'Preparing' || item.status === 'Uploading') {
      // Item is active, cancel it first
      this.cancelUpload(packageName)
    }

    this.uploadQueue = this.uploadQueue.filter((item) => item.packageName !== packageName)
    this.emitQueueUpdated()
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return

    // Find next queued item
    const nextItem = this.uploadQueue.find((item) => item.status === 'Queued')
    if (!nextItem) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true
    console.log(`[UploadService] Processing next upload: ${nextItem.packageName}`)

    try {
      this.updateItemStatus(nextItem.packageName, 'Preparing')

      if (nextItem.isLocalUpload) {
        const success = await this.processLocalUpload(nextItem)
        if (!success && nextItem.status !== 'Cancelled') {
          this.updateItemStatus(nextItem.packageName, 'Error', 0, 'Error', 'Upload failed')
        }
      } else {
        const zipPath = await this.prepareUpload(
          nextItem.packageName,
          nextItem.gameName,
          nextItem.versionCode,
          nextItem.deviceId
        )

        if (zipPath) {
          console.log(`[UploadService] Upload completed successfully for ${nextItem.packageName}`)
          this.updateItemStatus(
            nextItem.packageName,
            'Completed',
            100,
            'Complete',
            undefined,
            zipPath
          )
          await gameService.addToBlacklist(nextItem.packageName, nextItem.versionCode)
        } else {
          console.error(`[UploadService] Upload failed for ${nextItem.packageName}`)
          this.updateItemStatus(nextItem.packageName, 'Error', 0, 'Error', 'Upload failed')
        }
      }
    } catch (error) {
      console.error(`[UploadService] Error processing upload for ${nextItem.packageName}:`, error)
      this.updateItemStatus(
        nextItem.packageName,
        'Error',
        0,
        'Error',
        error instanceof Error ? error.message : 'Unknown error'
      )
    } finally {
      this.isProcessing = false
      this.processQueue()
    }
  }

  private generateMachineHwid(): string {
    const info = `${hostname()}-${userInfo().username}`
    return crypto.createHash('sha256').update(info).digest('hex')
  }

  private parseAXML(buf: Buffer): { packageName: string; versionCode: number } {
    if (buf.length < 8 || buf.readUInt16LE(0) !== 0x0003 || buf.readUInt16LE(2) !== 0x0008) {
      throw new Error('Not a valid Android binary XML')
    }

    const spStart = 8
    if (buf.readUInt16LE(spStart) !== 0x0001) throw new Error('Expected string pool chunk')

    const spSize = buf.readUInt32LE(spStart + 4)
    const numStrings = buf.readUInt32LE(spStart + 8)
    const flags = buf.readUInt32LE(spStart + 16)
    const stringsStart = buf.readUInt32LE(spStart + 20)
    const isUtf8 = (flags & 0x100) !== 0
    const offsetsBase = spStart + 28
    const strDataBase = spStart + stringsStart

    const strings: string[] = []
    for (let i = 0; i < numStrings; i++) {
      const strOff = buf.readUInt32LE(offsetsBase + i * 4)
      let p = strDataBase + strOff
      try {
        if (isUtf8) {
          const b0 = buf.readUInt8(p)
          p += b0 & 0x80 ? 2 : 1
          const b1 = buf.readUInt8(p)
          const u8len = b1 & 0x80 ? ((b1 & 0x7f) << 8) | buf.readUInt8(p + 1) : b1
          p += b1 & 0x80 ? 2 : 1
          strings.push(buf.slice(p, p + u8len).toString('utf8'))
        } else {
          const charLen = buf.readUInt16LE(p)
          strings.push(buf.slice(p + 2, p + 2 + charLen * 2).toString('utf16le'))
        }
      } catch {
        strings.push('')
      }
    }

    let pos = spStart + spSize
    let packageName = ''
    let versionCode = 0

    while (pos + 8 <= buf.length) {
      const chunkType = buf.readUInt16LE(pos)
      const chunkSize = buf.readUInt32LE(pos + 4)
      if (chunkSize < 8 || pos + chunkSize > buf.length) break

      if (chunkType === 0x0102) {
        const nameIdx = buf.readInt32LE(pos + 20)
        if (nameIdx >= 0 && nameIdx < strings.length && strings[nameIdx] === 'manifest') {
          const attrCount = buf.readUInt16LE(pos + 28)
          const attrBase = pos + 36
          for (let i = 0; i < attrCount; i++) {
            const ab = attrBase + i * 20
            if (ab + 20 > buf.length) break
            const ni = buf.readInt32LE(ab + 4)
            const attrName = ni >= 0 && ni < strings.length ? strings[ni] : ''
            const dataType = buf.readUInt8(ab + 15)
            const data = buf.readInt32LE(ab + 16)
            if (attrName === 'package' && dataType === 0x03 && data >= 0 && data < strings.length) {
              packageName = strings[data]
            } else if (attrName === 'versionCode' && (dataType === 0x10 || dataType === 0x11)) {
              versionCode = data > 0 ? data : 0
            }
          }
          if (packageName) break
        }
      }
      pos += chunkSize
    }

    if (!packageName) throw new Error('Could not extract package name from AndroidManifest.xml')
    return { packageName, versionCode }
  }

  private async getApkInfo(
    apkPath: string
  ): Promise<{ packageName: string; versionCode: number }> {
    const sevenZipPath = dependencyService.get7zPath()
    const tmpDir = join(this.uploadsBasePath, `apk_parse_${Date.now()}`)
    try {
      await fs.mkdir(tmpDir, { recursive: true })
      await new Promise<void>((resolve, reject) => {
        const stream = SevenZip.extractFull(apkPath, tmpDir, {
          $bin: sevenZipPath,
          $cherryPick: ['AndroidManifest.xml']
        })
        stream.on('end', resolve)
        stream.on('error', reject)
      })
      const buf = await fs.readFile(join(tmpDir, 'AndroidManifest.xml'))
      return this.parseAXML(buf)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  private async validateLocalFolder(folderPath: string): Promise<void> {
    const entries = await fs.readdir(folderPath)
    const apkFiles = entries.filter((e) => e.toLowerCase().endsWith('.apk'))

    if (apkFiles.length === 0) {
      throw new Error(`No APK file found in folder "${basename(folderPath)}"`)
    }

    if (apkFiles.length > 1) {
      throw new Error(
        `Multiple APK files found in "${basename(folderPath)}": ${apkFiles.join(', ')}. ` +
          `Each folder must contain exactly one APK file.`
      )
    }
  }

  private async processLocalUpload(item: UploadItem): Promise<boolean> {
    if (!item.sourcePath) return false

    try {
      const isZip = item.sourcePath.toLowerCase().endsWith('.zip')

      if (isZip) {
        this.updateItemStatus(item.packageName, 'Uploading', 0, 'Uploading to server')
        this.updateProgress(item.packageName, UploadStage.Uploading, 0)
        const success = await this.uploadToServer(item.packageName, item.sourcePath)
        if (!success) throw new Error('Upload failed')
        this.updateItemStatus(item.packageName, 'Completed', 100, 'Complete')
        return true
      } else {
        // Build a staging folder with all contents + HWID.txt, then compress and upload
        this.updateProgress(item.packageName, UploadStage.Compressing, 0)

        const sevenZipPath = dependencyService.get7zPath()
        if (!sevenZipPath) throw new Error('7zip not found. Cannot create zip archive.')

        const hwid = this.generateMachineHwid()
        const hwidPrefix = hwid.substring(0, 1)

        const stagingDir = join(this.uploadsBasePath, `staging_${Date.now()}`)
        await fs.mkdir(stagingDir, { recursive: true })

        try {
          // Copy source folder contents into staging
          const entries = await fs.readdir(item.sourcePath!, { withFileTypes: true })
          for (const entry of entries) {
            const src = join(item.sourcePath!, entry.name)
            const dst = join(stagingDir, entry.name)
            if (entry.isDirectory()) {
              await fs.cp(src, dst, { recursive: true })
            } else {
              await fs.copyFile(src, dst)
            }
          }

          // Add HWID.txt
          await fs.writeFile(join(stagingDir, 'HWID.txt'), hwid, 'utf-8')

          this.updateProgress(item.packageName, UploadStage.Compressing, 10)

          const safeGameName = item.gameName.replace(/[<>:"/\\|?*]/g, '_')
          const zipFileName = `${safeGameName} v${item.versionCode} ${item.packageName} ${hwidPrefix} PC.zip`
          const zipFilePath = join(this.uploadsBasePath, zipFileName)

          if (existsSync(zipFilePath)) {
            await fs.unlink(zipFilePath)
          }

          await new Promise<void>((resolve, reject) => {
            const myStream = SevenZip.add(zipFilePath, `${stagingDir}/*`, {
              $bin: sevenZipPath,
              $progress: true
            })

            if (!myStream) {
              reject(new Error('Failed to start 7zip compression process.'))
              return
            }

            this.activeCompression = myStream
            myStream.on('progress', (progress) => {
              // Scale 10–90% while compressing
              this.updateProgress(
                item.packageName,
                UploadStage.Compressing,
                10 + Math.floor(progress.percent * 0.8)
              )
            })
            myStream.on('end', () => {
              this.activeCompression = null
              resolve()
            })
            myStream.on('error', (error) => {
              this.activeCompression = null
              reject(error)
            })
          })

          this.updateProgress(item.packageName, UploadStage.Compressing, 100)

          this.updateItemStatus(item.packageName, 'Uploading', 0, 'Uploading to server')
          this.updateProgress(item.packageName, UploadStage.Uploading, 0)
          const success = await this.uploadToServer(item.packageName, zipFilePath)
          if (!success) throw new Error('Upload failed')
          this.updateItemStatus(item.packageName, 'Completed', 100, 'Complete')
          return true
        } finally {
          await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {})
        }
      }
    } catch (error) {
      console.error(`[UploadService] Error processing local upload for ${item.gameName}:`, error)
      this.emitProgress(item.packageName, 'Error', 0)
      return false
    }
  }

  public async addLocalItemsToQueue(
    paths: string[]
  ): Promise<{ errors: LocalUploadError[] }> {
    const errors: LocalUploadError[] = []

    // Validate all items first - refuse to add anything if any fail
    for (const itemPath of paths) {
      try {
        const isZip = itemPath.toLowerCase().endsWith('.zip')
        if (!isZip) {
          const stat = await fs.stat(itemPath)
          if (!stat.isDirectory()) {
            errors.push({
              path: itemPath,
              error: `"${basename(itemPath)}" is not a folder or ZIP file`
            })
            continue
          }
          await this.validateLocalFolder(itemPath)
        } else {
          // Verify the zip file exists and is readable
          await fs.access(itemPath)
        }
      } catch (error) {
        errors.push({
          path: itemPath,
          error: error instanceof Error ? error.message : 'Unknown validation error'
        })
      }
    }

    if (errors.length > 0) {
      return { errors }
    }

    // All valid — add to queue
    for (const itemPath of paths) {
      const name = basename(itemPath)
      const isZip = name.toLowerCase().endsWith('.zip')
      const displayName = isZip ? name.slice(0, -4) : name

      // Try to extract real package name / version from the APK for folders
      let pkgName = `local_${crypto.randomBytes(4).toString('hex')}_${Date.now()}`
      let versionCode = 0
      if (!isZip) {
        try {
          const entries = await fs.readdir(itemPath)
          const apkFile = entries.find((e) => e.toLowerCase().endsWith('.apk'))
          if (apkFile) {
            const info = await this.getApkInfo(join(itemPath, apkFile))
            pkgName = info.packageName
            versionCode = info.versionCode
            console.log(`[UploadService] APK info: ${pkgName} v${versionCode}`)
          }
        } catch (err) {
          console.warn(`[UploadService] Could not parse APK info for ${itemPath}:`, err)
        }
      }

      // Skip if already actively queued
      const existing = this.findItem(pkgName)
      if (
        existing &&
        existing.status !== 'Error' &&
        existing.status !== 'Cancelled' &&
        existing.status !== 'Completed'
      ) {
        console.log(`[UploadService] ${pkgName} already in queue, skipping`)
        continue
      }

      const newItem: UploadItem = {
        packageName: pkgName,
        gameName: displayName,
        versionCode,
        deviceId: 'local',
        status: 'Queued',
        progress: 0,
        addedDate: Date.now(),
        isLocalUpload: true,
        sourcePath: itemPath
      }

      this.uploadQueue.push(newItem)
      console.log(`[UploadService] Added local item "${displayName}" (${pkgName} v${versionCode}) to upload queue.`)
    }

    this.emitQueueUpdated()

    if (!this.isProcessing) {
      this.processQueue()
    }

    return { errors: [] }
  }

  public async prepareUpload(
    packageName: string,
    gameName: string,
    versionCode: number,
    deviceId: string
  ): Promise<string | null> {
    if (this.status !== 'INITIALIZED') {
      throw new Error('UploadService is not initialized')
    }

    try {
      // --- SETUP STAGE ---
      this.updateProgress(packageName, UploadStage.Setup, 0)

      // Get device info
      const devicesList = await adbService.listDevices()
      const deviceInfo = devicesList.find((d) => d.id === deviceId)

      if (!deviceInfo) {
        throw new Error(`Device with ID ${deviceId} not found or not connected`)
      }

      // Use model as device codename
      const deviceCodename = deviceInfo.model || 'unknown'

      // Generate HWID
      const hwid = this.generateHWID(deviceId)
      const hwidPrefix = hwid.substring(0, 1)

      // Create folder path for the app
      const packageFolderName = packageName
      const packageFolderPath = join(this.uploadsBasePath, packageFolderName)

      // Clean up any existing folder
      if (existsSync(packageFolderPath)) {
        await fs.rm(packageFolderPath, { recursive: true, force: true })
      }

      // Create the app folder
      await fs.mkdir(packageFolderPath, { recursive: true })
      this.updateProgress(packageName, UploadStage.Setup, 100)

      // --- PULLING APK STAGE ---
      this.updateProgress(packageName, UploadStage.PullingApk, 0)

      // Get the path to the APK on the device
      const shellCmd = `pm path ${packageName}`
      const apkPathOutput = await adbService.runShellCommand(deviceId, shellCmd)

      if (!apkPathOutput || !apkPathOutput.includes('package:')) {
        throw new Error(`Could not find APK for ${packageName} on device`)
      }

      // Extract the APK path from the output
      const apkPath = apkPathOutput.trim().split('\n')[0].replace('package:', '')
      const apkFileName = `${packageName}.apk`
      const localApkPath = join(packageFolderPath, apkFileName)

      // Pull the APK file
      this.updateProgress(packageName, UploadStage.PullingApk, 50)
      console.log(`Pulling APK from ${apkPath} to ${localApkPath}...`)
      await adbService.pullFile(deviceId, apkPath, localApkPath)
      this.updateProgress(packageName, UploadStage.PullingApk, 100)

      // --- ANALYZING OBB STAGE ---
      this.updateProgress(packageName, UploadStage.AnalyzingObb, 0)

      // Check if OBB folder exists
      const obbFolderPath = `/sdcard/Android/obb/${packageName}`
      const obbCheckCmd = `[ -d "${obbFolderPath}" ] && echo "EXISTS" || echo ""`
      const obbExists = await adbService.runShellCommand(deviceId, obbCheckCmd)
      this.updateProgress(packageName, UploadStage.AnalyzingObb, 50)

      // --- PULLING OBB STAGE ---
      this.updateProgress(packageName, UploadStage.PullingObb, 0)

      // Pull OBB folder if it exists
      if (obbExists && obbExists.includes('EXISTS')) {
        console.log(`OBB folder found for ${packageName}, analyzing contents...`)

        // Create the main OBB folder locally
        const localObbFolder = join(packageFolderPath, packageFolderName)
        await fs.mkdir(localObbFolder, { recursive: true })

        // List all files in the OBB folder recursively with their sizes
        const listFilesCmd = `find "${obbFolderPath}" -type f -printf "%s %p\\n"`
        const filesListOutput = await adbService.runShellCommand(deviceId, listFilesCmd)
        this.updateProgress(packageName, UploadStage.AnalyzingObb, 100)

        if (!filesListOutput || !filesListOutput.trim()) {
          console.log(`No files found in OBB folder for ${packageName}`)
          this.updateProgress(packageName, UploadStage.PullingObb, 100)
        } else {
          // Parse the output to get files with their sizes
          const fileEntries = filesListOutput
            .trim()
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => {
              const match = line.match(/^(\d+)\s+(.+)$/)
              if (match) {
                return {
                  size: parseInt(match[1], 10),
                  path: match[2]
                }
              }
              return null
            })
            .filter((entry) => entry !== null) as { size: number; path: string }[]

          const totalSize = fileEntries.reduce((sum, entry) => sum + entry.size, 0)
          let downloadedSize = 0

          console.log(
            `Found ${fileEntries.length} files in OBB folder, total size: ${totalSize} bytes`
          )

          // Pull each file one by one, maintaining directory structure
          for (let i = 0; i < fileEntries.length; i++) {
            const { path: remotePath, size } = fileEntries[i]

            // Create relative path from OBB folder root
            const relPath = remotePath.substring(obbFolderPath.length + 1) // +1 for the slash
            const localPath = join(localObbFolder, relPath)

            // Ensure parent directory exists
            const parentDir = dirname(localPath)
            await fs.mkdir(parentDir, { recursive: true })

            console.log(
              `Pulling file ${i + 1}/${fileEntries.length}: ${remotePath} (${size} bytes)`
            )
            await adbService.pullFile(deviceId, remotePath, localPath)

            // Update progress
            downloadedSize += size
            const progressPercentage = Math.min(Math.floor((downloadedSize / totalSize) * 100), 100)
            this.updateProgress(packageName, UploadStage.PullingObb, progressPercentage)
          }

          console.log(`Successfully pulled all OBB files for ${packageName}`)
        }
      } else {
        console.log(`No OBB folder found for ${packageName}`)
        this.updateProgress(packageName, UploadStage.PullingObb, 100)
      }

      // --- CREATING METADATA STAGE ---
      this.updateProgress(packageName, UploadStage.CreatingMetadata, 0)

      // Create HWID.txt file
      await fs.writeFile(join(packageFolderPath, 'HWID.txt'), hwid, 'utf-8')
      this.updateProgress(packageName, UploadStage.CreatingMetadata, 100)

      // --- COMPRESSING STAGE ---
      this.updateProgress(packageName, UploadStage.Compressing, 0)

      // Create the zip file
      const zipFileName = `${gameName} v${versionCode} ${packageName} ${hwidPrefix} ${deviceCodename}.zip`
      const zipFilePath = join(this.uploadsBasePath, zipFileName)

      // Delete existing zip file if it exists
      if (existsSync(zipFilePath)) {
        await fs.unlink(zipFilePath)
      }

      // Compress the folder using 7zip
      const sevenZipPath = dependencyService.get7zPath()
      if (!sevenZipPath) {
        throw new Error('7zip not found. Cannot create zip archive.')
      }

      console.log(`Creating zip archive at ${zipFilePath}...`)

      await new Promise<void>((resolve, reject) => {
        const myStream = SevenZip.add(zipFilePath, `${packageFolderPath}/*`, {
          $bin: sevenZipPath,
          $progress: true
        })

        if (!myStream) {
          throw new Error('Failed to start 7zip compression process.')
        }

        // Store the compression stream for cancellation
        this.activeCompression = myStream

        // Set up progress tracking
        let lastProgress = 0

        myStream.on('progress', (progress) => {
          if (progress.percent > lastProgress) {
            lastProgress = progress.percent
            console.log(`[Compression progress]: ${progress.percent}%`)
            this.updateProgress(packageName, UploadStage.Compressing, progress.percent)
          }
        })

        myStream.on('end', () => {
          console.log(`[Compression complete]: ${zipFilePath}`)
          this.activeCompression = null
          resolve()
        })

        myStream.on('error', (error) => {
          console.error(`[Compression error]: ${error}`)
          this.activeCompression = null
          reject(error)
        })
      })

      this.updateProgress(packageName, UploadStage.Compressing, 100)

      await fs.rm(packageFolderPath, { recursive: true, force: true })

      // --- UPLOADING STAGE ---
      this.updateProgress(packageName, UploadStage.Uploading, 0)

      // Check if the generated zip file exists
      if (!existsSync(zipFilePath)) {
        throw new Error(`Zip file not found: ${zipFilePath}`)
      }

      try {
        // Update item status for upload stage
        this.updateItemStatus(packageName, 'Uploading', 0, 'Uploading to server')

        // Upload the zip file to the server
        const uploadSuccess = await this.uploadToServer(packageName, zipFilePath)

        if (!uploadSuccess) {
          throw new Error('Failed to upload to server')
        }

        this.updateProgress(packageName, UploadStage.Uploading, 100)
      } catch (uploadError) {
        console.error(`Error uploading ${zipFilePath} to server:`, uploadError)
        throw uploadError
      }

      // --- COMPLETE STAGE ---
      this.updateProgress(packageName, UploadStage.Complete, 100)
      console.log(`Upload completed: ${zipFilePath}`)

      return zipFilePath
    } catch (error) {
      console.error(`Error preparing upload for ${packageName}:`, error)
      this.emitProgress(packageName, 'Error', 0)
      return null
    }
  }

  /**
   * Uploads the zip file to the server using rclone
   * @param packageName The package name
   * @param zipFilePath Path to the zip file to upload
   * @returns true if upload was successful, false otherwise
   */
  private async uploadToServer(packageName: string, zipFilePath: string): Promise<boolean> {
    console.log(`[UploadService] Starting upload of ${zipFilePath} to server`)

    if (!existsSync(this.configFilePath)) {
      console.error(`[UploadService] upload.config not found at: ${this.configFilePath}`)
      throw new Error(
        'upload.config not found — connect to the server at least once so the config is downloaded'
      )
    }

    const rclonePath = dependencyService.getRclonePath()
    if (!rclonePath) {
      console.error('[UploadService] Rclone path not found.')
      throw new Error('Rclone dependency not found')
    }

    try {
      // Now upload the actual zip file with progress tracking
      console.log(`[UploadService] Starting upload of zip file: ${zipFilePath}`)

      this.activeUpload = execa(
        rclonePath,
        [
          'copy',
          zipFilePath,
          'RSL-gameuploads:',
          '--config',
          this.configFilePath,
          '--checkers',
          '1',
          '--retries',
          '2',
          '--inplace',
          '--progress',
          '--stats',
          '1s',
          '--stats-one-line'
        ],
        {
          all: true,
          buffer: false,
          windowsHide: true
        }
      )

      if (!this.activeUpload || !this.activeUpload.all) {
        throw new Error('Failed to start rclone upload process')
      }

      // Parse progress from rclone output
      const transferRegex = /(\d+)%/

      this.activeUpload.all.on('data', (data: Buffer) => {
        const output = data.toString()
        console.log(`[Upload Output] ${output}`)

        // Look for percentage in the output
        const lines = output.split('\n')
        for (const line of lines) {
          const matches = line.match(transferRegex)
          if (matches && matches[1]) {
            const progress = parseInt(matches[1], 10)
            if (!isNaN(progress)) {
              this.updateProgress(packageName, UploadStage.Uploading, progress)
            }
          }
        }
      })

      // Wait for the upload to complete
      await this.activeUpload

      console.log(`[UploadService] Zip file uploaded successfully`)

      // Clean up

      try {
        await fs.unlink(zipFilePath)
      } catch (error) {
        console.warn(`[UploadService] Failed to delete zip file: ${zipFilePath}`, error)
      }

      this.activeUpload = null
      return true
    } catch (error) {
      console.error(`[UploadService] Error uploading to server:`, error)
      if (this.activeUpload) {
        try {
          this.activeUpload.kill('SIGTERM')
        } catch (killError) {
          console.warn(`[UploadService] Error killing active upload:`, killError)
        }
        this.activeUpload = null
      }
      throw error
    }
  }

  public cancelUpload(packageName: string): void {
    let cancelled = false

    // Cancel active compression if running
    if (this.activeCompression) {
      console.log(`[UploadService] Cancelling active compression`)
      try {
        this.activeCompression.destroy()
        this.activeCompression = null
        cancelled = true
      } catch (error) {
        console.error(`[UploadService] Error cancelling compression:`, error)
      }
    }

    // Cancel active upload if running
    if (this.activeUpload) {
      console.log(`[UploadService] Cancelling active upload`)
      try {
        this.activeUpload.kill('SIGTERM')
        this.activeUpload = null
        cancelled = true
      } catch (error) {
        console.error(`[UploadService] Error cancelling upload:`, error)
      }
    }

    if (cancelled) {
      this.emitProgress(packageName, 'Cancelled', 0)
      this.updateItemStatus(packageName, 'Cancelled', 0, 'Cancelled')
    } else {
      console.log(`[UploadService] No active upload or compression to cancel`)
    }
  }
}

export default new UploadService()
