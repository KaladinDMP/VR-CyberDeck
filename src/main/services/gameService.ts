import { join, dirname } from 'path'
import { promises as fs, readdirSync } from 'fs'
import { execa } from 'execa'
import { app, BrowserWindow, dialog } from 'electron'
import { existsSync } from 'fs'
import dependencyService from './dependencyService'
import mirrorService from './mirrorService'
import settingsService from './settingsService'
import { GameInfo, ServiceStatus, GamesAPI, BlacklistEntry } from '@shared/types'
import EventEmitter from 'events'
import { typedWebContentsSend } from '@shared/ipc-utils'
import SevenZip from 'node-7z'

interface VrpConfig {
  baseUri: string
  password: string
  lastSync?: Date
}

interface SnapshotEntry {
  /** ms timestamp this packageName first appeared in our snapshot. 0 marks
   *  packages that were present on initial-sync (so we don't badge every
   *  game NEW after a clean install). */
  firstSeenAt: number
  /** Version string last seen for this package. */
  version: string
  /** ms timestamp of most recent version change. 0 if never changed. */
  versionChangedAt: number
}

interface LibrarySnapshot {
  /** Per-package state used to drive the NEW / UPDATED badges. */
  packages: Record<string, SnapshotEntry>
  /** ms timestamp the snapshot was first created. */
  initializedAt: number
  /** Schema version so we can migrate / invalidate later if needed. */
  version: number
}

const SNAPSHOT_VERSION = 1

const INTERNAL_BLACKLIST_GAMES = ['com.oculus.MiramarSetupRetail']

class GameService extends EventEmitter implements GamesAPI {
  private dataPath: string
  private configPath: string
  private gameListPath: string
  private metaPath: string
  private blacklistGamesPath: string
  private customBlacklistPath: string
  private serverInfoPath: string
  private librarySnapshotPath: string
  private librarySnapshot: LibrarySnapshot | null = null
  private customNotesPath: string
  private vrpConfig: VrpConfig | null = null
  private games: GameInfo[] = []
  private blacklistGames: string[] = []
  private customBlacklistGames: BlacklistEntry[] = []
  private status: ServiceStatus = 'NOT_INITIALIZED'
  constructor() {
    super()
    this.dataPath = join(app.getPath('userData'), 'vrp-data')
    this.configPath = join(this.dataPath, 'vrp-config.json')
    this.gameListPath = join(this.dataPath, 'VRP-GameList.txt')
    this.metaPath = join(this.dataPath, '.meta')
    this.blacklistGamesPath = join(this.metaPath, 'nouns', 'blacklist.txt')
    this.customBlacklistPath = join(app.getPath('userData'), 'custom-blacklist.json')
    this.serverInfoPath = join(app.getPath('userData'), 'ServerInfo.json')
    this.librarySnapshotPath = join(app.getPath('userData'), 'library-snapshot.json')
    this.customNotesPath = join(app.getPath('userData'), 'custom-notes.json')
  }

  async initialize(force?: boolean): Promise<ServiceStatus> {
    if (this.status === 'INITIALIZING') {
      console.log('GameService already initializing, skipping.')
      return 'INITIALIZING'
    }
    if (!force && this.status === 'INITIALIZED') {
      console.log('GameService already initialized, skipping.')
      return 'INITIALIZED'
    }
    this.status = 'INITIALIZING'
    console.log('Initializing GameService...')
    await fs.mkdir(this.dataPath, { recursive: true })
    try {
      // Load configuration if exists
      await this.loadConfig()

      // Check if we need to sync data
      // const needsSync = await this.needsSync()

      // if (needsSync) {
      //   console.log('Syncing game data...')
      //   await this.syncGameData()
      // } else {
      console.log('Using cached game data...')
      await this.loadLibrarySnapshot()
      await this.loadGameList()
      await this.loadBlacklistGames()
      await this.loadCustomBlacklistGames()
      //}
    } catch (error) {
      console.error('Error initializing game service:', error)
      this.status = 'ERROR'
      return 'ERROR'
    } finally {
      this.status = 'INITIALIZED'
    }
    return 'INITIALIZED'
  }

  private async loadConfig(): Promise<void> {
    try {
      // Always prefer the in-app settings value (source of truth) if populated.
      const fromSettings = settingsService.getServerConfig()
      let diskConfig: VrpConfig | null = null

      const exists = await fileExists(this.configPath)
      if (exists) {
        try {
          const data = await fs.readFile(this.configPath, 'utf-8')
          diskConfig = JSON.parse(data)
          if (diskConfig?.lastSync) {
            diskConfig.lastSync = new Date(diskConfig.lastSync)
          }
        } catch (err) {
          console.warn('Failed to read cached vrp-config.json:', err)
        }
      }

      if (fromSettings.baseUri && fromSettings.password) {
        this.vrpConfig = {
          baseUri: fromSettings.baseUri,
          password: fromSettings.password,
          lastSync: diskConfig?.lastSync
        }
        console.log('Loaded server config from settings - baseUri:', !!this.vrpConfig.baseUri)
        // Keep vrp-config.json in sync with the settings values.
        await this.saveConfig()
        return
      }

      if (diskConfig && diskConfig.baseUri && diskConfig.password) {
        this.vrpConfig = diskConfig
        // Migrate legacy values into settings so they become editable in the UI.
        settingsService.setServerConfig({
          baseUri: diskConfig.baseUri,
          password: diskConfig.password
        })
        console.log('Loaded server config from vrp-config.json and migrated to settings')
        return
      }

      console.log('No server credentials configured yet; prompting user.')
      await this.fetchVrpPublicInfo()
    } catch (error) {
      console.error('Error loading configuration:', error)
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      if (this.vrpConfig) {
        console.log(
          'Saving config to disk - baseUri:',
          !!this.vrpConfig.baseUri,
          'password:',
          !!this.vrpConfig.password
        )
        await fs.writeFile(this.configPath, JSON.stringify(this.vrpConfig), 'utf-8')
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
    }
  }

  // private async needsSync(): Promise<boolean> {
  //   try {
  //     // Check if game list file exists
  //     const gameListExists = await fileExists(this.gameListPath)
  //     if (!gameListExists) {
  //       return true
  //     }

  //     // If no last sync time or it's been more than 24 hours, sync again
  //     if (!this.vrpConfig?.lastSync) {
  //       return true
  //     }

  //     const lastSync = this.vrpConfig.lastSync
  //     const ONE_DAY = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  //     return Date.now() - lastSync.getTime() > ONE_DAY
  //   } catch (error) {
  //     console.error('Error checking if sync is needed:', error)
  //     return true // Default to sync on error
  //   }
  // }

  async syncGameData(): Promise<void> {
    try {
      // First fetch the VRP public info
      await this.fetchVrpPublicInfo()

      if (!this.vrpConfig?.baseUri) {
        throw new Error('Failed to get baseUri from VRP public info')
      }

      if (!this.vrpConfig?.password) {
        throw new Error('Failed to get password from VRP public info')
      }

      console.log(
        'Starting sync with valid config - baseUri:',
        !!this.vrpConfig.baseUri,
        'password:',
        !!this.vrpConfig.password
      )

      // Download meta.7z using rclone
      const metaArchive = join(this.dataPath, 'meta.7z')
      await this.downloadMetaArchive(metaArchive)

      // Extract the archive
      await this.extractMetaArchive(metaArchive)

      // Load the game list
      await this.loadLibrarySnapshot()
      await this.loadGameList()
      await this.loadBlacklistGames()
      await this.loadCustomBlacklistGames()

      // Update last sync time
      if (this.vrpConfig) {
        this.vrpConfig.lastSync = new Date()
        await this.saveConfig()
      }
    } catch (error) {
      console.error('Error syncing game data:', error)
      throw error
    }
  }

  private async fetchVrpPublicInfo(): Promise<void> {
    try {
      let data: VrpConfig | null = null

      // 1) Preferred source: in-app settings (user can paste JSON or fill fields in Settings UI)
      const settingsConfig = settingsService.getServerConfig()
      if (settingsConfig.baseUri && settingsConfig.password) {
        data = {
          baseUri: settingsConfig.baseUri,
          password: settingsConfig.password
        }
        console.log('Server config loaded from in-app settings')
      }

      // 2) Fall back to legacy ServerInfo.json locations for backwards compatibility.
      //    If found and valid, migrate the values into the settings store so the
      //    user never has to touch the file again.
      if (!data) {
        const userFile = this.serverInfoPath
        const bundledFile = join(process.resourcesPath, 'ServerInfo.json')

        for (const filePath of [userFile, bundledFile]) {
          try {
            const exists = await fileExists(filePath)
            if (exists) {
              const raw = await fs.readFile(filePath, 'utf-8')
              const parsed = JSON.parse(raw) as VrpConfig
              if (parsed?.baseUri && parsed?.password) {
                data = parsed
                console.log('Server config loaded from legacy file:', filePath)
                // Migrate into settings so this becomes the source of truth.
                settingsService.setServerConfig({
                  baseUri: parsed.baseUri,
                  password: parsed.password
                })
                break
              }
            }
          } catch (err) {
            console.warn('Failed to read ServerInfo.json from', filePath, err)
          }
        }
      }

      // If no credentials available, prompt the user to paste them into Settings.
      if (!data || !data.baseUri || !data.password) {
        await dialog
          .showMessageBox({
            type: 'info',
            title: 'Server Configuration Required',
            message: 'Please configure your server credentials',
            detail:
              `Server credentials have not been configured.\n\n` +
              `Open the app's Settings page and paste your server config JSON into the\n` +
              `"Server Configuration" section, e.g.:\n\n` +
              `{"baseUri":"https://your-url-here/","password":"your-password-here"}\n\n` +
              `You can also enter baseUri and password individually. Click "Save", then\n` +
              `restart the app (or resync game data) to continue.`,
            buttons: ['OK']
          })
          .catch(() => {
            /* no-op */
          })

        throw new Error(
          'Server credentials not configured. Please add them in Settings > Server Configuration.'
        )
      }

      this.vrpConfig = data

      console.log('Server config loaded - baseUri:', !!this.vrpConfig?.baseUri)

      await this.saveConfig()
    } catch (error) {
      console.error('Error loading VRP public info:', error)
      throw error
    }
  }

  private async downloadMetaArchive(destination: string): Promise<void> {
    try {
      if (!this.vrpConfig?.baseUri) {
        throw new Error('baseUri not found in config')
      }

      // Check if there's an active mirror to use
      const activeMirror = await mirrorService.getActiveMirror()
      const baseUri = this.vrpConfig.baseUri
      let rcloneArgs: string[]

      console.log(`Downloading meta.7z from ${baseUri}...`)

      // Get the appropriate rclone path based on platform
      const rclonePath = dependencyService.getRclonePath()

      // Get the main window to send progress updates
      const mainWindow = BrowserWindow.getAllWindows()[0]

      if (activeMirror) {
        console.log(`Using active mirror: ${activeMirror.name}`)

        // Get the config file path and remote name
        const configFilePath = mirrorService.getActiveMirrorConfigPath()
        const remoteName = mirrorService.getActiveMirrorRemoteName()

        if (!configFilePath || !remoteName) {
          console.warn('Failed to get mirror config file path, falling back to public endpoint')
          // Fall back to public endpoint logic below
        } else {
          try {
            // Use mirror with direct config file reference.
            // `copy <file_source> <dir_dest>` is the unambiguous "drop this file
            // into that directory" semantic; `sync` with our flag set was being
            // misclassified as a directory→directory operation on rclone 1.72.1.
            rcloneArgs = [
              'copy',
              `${remoteName}:/Quest Games/meta.7z`,
              dirname(destination),
              '--config',
              configFilePath,
              '--tpslimit',
              '1.0',
              '--tpslimit-burst',
              '3',
              '--no-check-certificate',
              '--progress'
            ]

            // Execute rclone using execa with progress reporting
            const rcloneProcess = execa(rclonePath, rcloneArgs, {
              stdio: ['ignore', 'pipe', 'pipe']
            })

            // Process stdout for progress information
            if (rcloneProcess.stdout) {
              rcloneProcess.stdout.on('data', (data) => {
                const output = data.toString()

                // Try to parse progress information from rclone output
                const progressPattern = /Transferred:.*?(\d+)%/
                const match = output.match(progressPattern)

                if (match && match[1]) {
                  const progressPercentage = parseInt(match[1], 10)

                  // Send progress to renderer process if we have a valid window
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    typedWebContentsSend.send(mainWindow, 'games:download-progress', {
                      packageName: 'meta',
                      stage: 'download',
                      progress: progressPercentage
                    })
                  }
                }
              })
            }

            // Process stderr for errors
            if (rcloneProcess.stderr) {
              rcloneProcess.stderr.on('data', (data) => {
                console.error('Rclone error:', data.toString())
              })
            }

            // Wait for process to complete
            const result = await rcloneProcess

            if (result.exitCode !== 0) {
              console.error(
                `Mirror download failed with exit code ${result.exitCode}, falling back to public endpoint`
              )
              throw new Error(`Mirror download failed: ${result.stderr}`)
            }

            console.log('Mirror download complete')

            // Send 100% progress on completion
            if (mainWindow && !mainWindow.isDestroyed()) {
              typedWebContentsSend.send(mainWindow, 'games:download-progress', {
                packageName: 'meta',
                stage: 'download',
                progress: 100
              })
            }
            return // Success with mirror
          } catch (error) {
            console.error('Failed to use mirror config file:', error)
            // Fall through to public endpoint logic
          }
        }
      }

      // Fall back to public endpoint if no mirror or mirror failed
      console.log('Using public endpoint for meta.7z download')

      // Get the appropriate null config path based on platform
      const nullConfigPath = process.platform === 'win32' ? 'NUL' : '/dev/null'

      // Execute rclone using execa with progress reporting.
      // `copy <file_source> <dir_dest>` drops the file into the dir. Used here
      // (not `sync` or `copyto`) because the rclone HTTP backend with our flag
      // set was misclassifying source type, and `copy` is unambiguous.
      const rcloneProcess = execa(
        rclonePath,
        [
          'copy',
          `:http:/meta.7z`,
          dirname(destination),
          '--config',
          nullConfigPath,
          '--http-url',
          baseUri,
          '--tpslimit',
          '1.0',
          '--tpslimit-burst',
          '3',
          '--no-check-certificate',
          '--progress'
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe']
        }
      )

      // Process stdout for progress information
      if (rcloneProcess.stdout) {
        rcloneProcess.stdout.on('data', (data) => {
          const output = data.toString()

          // Try to parse progress information from rclone output
          // Example pattern: "Transferred: 5.584M / 10.000 MBytes, 56%, 1.000 MBytes/s, ETA 0s"
          const progressPattern = /Transferred:.*?(\d+)%/
          const match = output.match(progressPattern)

          if (match && match[1]) {
            const progressPercentage = parseInt(match[1], 10)

            // Send progress to renderer process if we have a valid window
            if (mainWindow && !mainWindow.isDestroyed()) {
              typedWebContentsSend.send(mainWindow, 'games:download-progress', {
                packageName: 'meta',
                stage: 'download',
                progress: progressPercentage
              })
            }
          }
        })
      }

      // Process stderr for errors
      if (rcloneProcess.stderr) {
        rcloneProcess.stderr.on('data', (data) => {
          console.error('Rclone error:', data.toString())
        })
      }

      // Wait for process to complete
      const result = await rcloneProcess

      if (result.exitCode !== 0) {
        throw new Error(`Rclone failed with exit code ${result.exitCode}: ${result.stderr}`)
      }

      console.log('Download complete')

      // Send 100% progress on completion
      if (mainWindow && !mainWindow.isDestroyed()) {
        typedWebContentsSend.send(mainWindow, 'games:download-progress', {
          packageName: 'meta',
          stage: 'download',
          progress: 100
        })
      }
    } catch (error) {
      console.error('Error downloading meta archive:', error)
      throw error
    }
  }

  private async extractMetaArchive(archive: string): Promise<void> {
    try {
      console.log(`Extracting ${archive} to ${this.dataPath}...`)

      if (!this.vrpConfig?.password) {
        throw new Error('Password not found in vrpConfig')
      }

      try {
        // Base64 decode the password
        const decodedPassword = Buffer.from(this.vrpConfig.password, 'base64').toString('utf-8')
        console.log('Successfully decoded password for extraction')
        console.log('Using node-7z to extract archive start')

        const mainWindow = BrowserWindow.getAllWindows()[0]

        await new Promise<void>((resolve, reject) => {
          const myStream = SevenZip.extractFull(archive, this.dataPath, {
            $bin: dependencyService.get7zPath(),
            password: decodedPassword,
            $progress: true
          })

          myStream.on('progress', function (progress) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              typedWebContentsSend.send(mainWindow, 'games:download-progress', {
                packageName: 'meta',
                stage: 'extract',
                progress: progress.percent
              })
            }
          })

          myStream.on('end', function () {
            console.log('Extraction complete')
            resolve() // Resolve the Promise when extraction is complete
          })

          myStream.on('error', function (error) {
            console.error('Extraction error:', error)
            reject(error) // Reject the Promise if there's an error
          })
        })

        console.log('Extraction complete')

        // Send 100% progress on completion
        if (mainWindow && !mainWindow.isDestroyed()) {
          typedWebContentsSend.send(mainWindow, 'games:download-progress', {
            packageName: 'meta',
            stage: 'extract',
            progress: 100
          })
        }
      } catch (decodeError: unknown) {
        console.error('Error decoding or using password:', decodeError)
        if (decodeError instanceof Error) {
          throw new Error(`Failed to use password: ${decodeError.message}`)
        } else {
          throw new Error(`Failed to use password: ${String(decodeError)}`)
        }
      }
    } catch (error) {
      console.error('Error extracting meta archive:', error)
      throw error
    }
  }

  private async resolveGameListPath(): Promise<string | null> {
    // Match any file ending in "amelist.txt" (e.g. VRP-GameList.txt, GameList.txt)
    // since the server naming convention can change
    try {
      const entries = await fs.readdir(this.dataPath)
      const match = entries.find((name) => /amelist\.txt$/i.test(name))
      if (match) {
        return join(this.dataPath, match)
      }
    } catch (error) {
      console.error('Error reading data path while resolving game list file:', error)
    }
    return null
  }

  private async loadGameList(): Promise<void> {
    try {
      const resolvedPath = await this.resolveGameListPath()
      if (!resolvedPath) {
        console.error('Game list file not found (looking for *amelist.txt in', this.dataPath, ')')
        return
      }

      this.gameListPath = resolvedPath
      console.log('Using game list file:', this.gameListPath)

      const data = await fs.readFile(this.gameListPath, 'utf-8')
      this.parseGameList(data)
    } catch (error) {
      console.error('Error loading game list:', error)
    }
  }

  private async loadBlacklistGames(): Promise<void> {
    const exists = await fileExists(this.blacklistGamesPath)
    if (!exists) {
      console.error('Blacklist games file not found')
      return
    }
    const data = await fs.readFile(this.blacklistGamesPath, 'utf-8')
    this.blacklistGames = data.split('\n')
    console.log(`Loaded ${this.blacklistGames.length} games from blacklist`)
  }

  private async loadLibrarySnapshot(): Promise<void> {
    try {
      if (existsSync(this.librarySnapshotPath)) {
        const raw = await fs.readFile(this.librarySnapshotPath, 'utf-8')
        const parsed = JSON.parse(raw) as LibrarySnapshot
        if (parsed && typeof parsed === 'object' && parsed.packages) {
          this.librarySnapshot = parsed
          console.log(
            `Loaded library snapshot with ${Object.keys(parsed.packages).length} packages`
          )
          return
        }
      }
    } catch (err) {
      console.warn('Failed to load library snapshot, starting fresh:', err)
    }
    this.librarySnapshot = null
  }

  private async saveLibrarySnapshot(): Promise<void> {
    if (!this.librarySnapshot) return
    try {
      await fs.writeFile(
        this.librarySnapshotPath,
        JSON.stringify(this.librarySnapshot),
        'utf-8'
      )
    } catch (err) {
      console.warn('Failed to save library snapshot:', err)
    }
  }

  /**
   * Reconcile the freshly parsed library against the on-disk snapshot:
   *
   *   - If the snapshot doesn't exist yet (clean install or first run after
   *     this feature shipped), every current package is recorded with
   *     firstSeenAt = 0. The renderer treats firstSeenAt = 0 as "not new"
   *     so the user doesn't see a wall of NEW badges on day 1.
   *   - If a package isn't in the snapshot, it's recorded with
   *     firstSeenAt = now and the renderer will badge it NEW.
   *   - If a package IS in the snapshot but its version string changed,
   *     versionChangedAt is bumped to now and the renderer will badge it
   *     UPDATED.
   *
   * The chosen timestamps are also stamped onto each GameInfo so the
   * renderer can compute the badge purely from the GameInfo with no
   * extra IPC roundtrip.
   */
  private decorateAndUpdateSnapshot(games: GameInfo[]): void {
    const now = Date.now()
    const isFirstRun = !this.librarySnapshot
    if (!this.librarySnapshot) {
      this.librarySnapshot = {
        packages: {},
        initializedAt: now,
        version: SNAPSHOT_VERSION
      }
    }
    const snap = this.librarySnapshot
    let dirty = false

    for (const game of games) {
      const pkg = game.packageName
      if (!pkg) continue
      const ver = game.version || ''
      const existing = snap.packages[pkg]

      if (!existing) {
        // First time we've ever seen this package. On the very first sync we
        // mark them all as "always existed" (firstSeenAt = 0) so a clean
        // install doesn't badge every game NEW.
        const firstSeenAt = isFirstRun ? 0 : now
        snap.packages[pkg] = { firstSeenAt, version: ver, versionChangedAt: 0 }
        game.firstSeenAt = firstSeenAt
        game.versionChangedAt = 0
        dirty = true
      } else {
        if (existing.version !== ver) {
          existing.version = ver
          existing.versionChangedAt = now
          dirty = true
        }
        game.firstSeenAt = existing.firstSeenAt
        game.versionChangedAt = existing.versionChangedAt
      }
    }

    if (dirty) void this.saveLibrarySnapshot()
  }

  private async loadCustomBlacklistGames(): Promise<void> {
    try {
      if (existsSync(this.customBlacklistPath)) {
        const data = await fs.readFile(this.customBlacklistPath, 'utf-8')
        try {
          this.customBlacklistGames = JSON.parse(data)
          console.log(`Loaded ${this.customBlacklistGames.length} games from custom blacklist`)
        } catch (parseError) {
          console.error('Error parsing custom blacklist JSON:', parseError)
          this.customBlacklistGames = []
        }
      } else {
        console.log('No custom blacklist file found, starting with empty list')
        this.customBlacklistGames = []
      }
    } catch (error) {
      console.error('Error loading custom blacklist games:', error)
      this.customBlacklistGames = []
    }
  }

  private async saveCustomBlacklistGames(): Promise<void> {
    try {
      await fs.writeFile(
        this.customBlacklistPath,
        JSON.stringify(this.customBlacklistGames),
        'utf-8'
      )
      console.log(`Saved ${this.customBlacklistGames.length} games to custom blacklist`)
    } catch (error) {
      console.error('Error saving custom blacklist games:', error)
    }
  }

  private parseGameList(data: string): void {
    const lines = data.split('\n')
    const games: GameInfo[] = []

    // Skip the header line
    const headerLine = lines[0]
    if (!headerLine || !headerLine.includes(';')) {
      console.error('Invalid header format in game list')
      return
    }
    console.log('Header Line:', headerLine)

    // Extract column names from header
    const columns = headerLine.split(';').map((col) => col.trim())
    console.log('Parsed Columns:', columns)

    const gameNameIndex = columns.indexOf('Game Name')
    const packageNameIndex = columns.indexOf('Package Name')
    const versionCodeIndex = columns.indexOf('Version Code')
    const sizeIndex = columns.indexOf('Size (MB)')
    const lastUpdatedIndex = columns.indexOf('Last Updated')
    const releaseNameIndex = columns.indexOf('Release Name')
    const downloadsIndex = columns.indexOf('Downloads')

    // Batch-read thumbnail directory once instead of 2600+ existsSync calls
    const thumbnailDir = join(this.metaPath, 'thumbnails')
    let thumbnailSet: Set<string>
    try {
      thumbnailSet = new Set(readdirSync(thumbnailDir))
    } catch {
      thumbnailSet = new Set()
    }

    // Process data lines (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const parts = line.split(';')

        // Skip if we don't have all columns
        if (parts.length < columns.length) {
          console.warn(
            `Skipping incomplete game entry (expected ${columns.length}, got ${parts.length}): ${line}`
          )
          continue
        }

        // Get values from the correct column positions
        const gameName = gameNameIndex >= 0 ? parts[gameNameIndex].trim() : 'Unknown'
        const packageName = packageNameIndex >= 0 ? parts[packageNameIndex].trim() : ''
        const versionCode = versionCodeIndex >= 0 ? parts[versionCodeIndex].trim() : ''
        const size = sizeIndex >= 0 ? `${parts[sizeIndex].trim()} MB` : ''
        const lastUpdated = lastUpdatedIndex >= 0 ? parts[lastUpdatedIndex].trim() : ''
        const releaseName = releaseNameIndex >= 0 ? parts[releaseNameIndex].trim() : ''
        const downloads = downloadsIndex >= 0 ? parts[downloadsIndex].trim() : ''

        if (gameName === 'Unknown') {
          console.warn(
            `Game name is Unknown for line: ${line}. gameNameIndex: ${gameNameIndex}, parts[gameNameIndex]: ${parts[gameNameIndex]}`
          )
        }

        // Skip if we don't have essential information
        if (!gameName || !packageName) {
          console.warn(`Skipping game with missing name or package: ${line}`)
          continue
        }

        // Generate thumbnail path if the package name is available
        const thumbnailFile = `${packageName}.jpg`
        const thumbnailPath = packageName
          ? join(this.metaPath, 'thumbnails', thumbnailFile)
          : ''

        const thumbnailExists = packageName ? thumbnailSet.has(thumbnailFile) : false

        // Generate note path based on release name
        const notePath = releaseName ? join(this.metaPath, 'notes', `${releaseName}.txt`) : ''

        const gameInfo: GameInfo = {
          id: packageName || gameName.replace(/\s+/g, '-').toLowerCase(),
          name: gameName,
          packageName,
          version: versionCode,
          size,
          lastUpdated,
          releaseName,
          downloads: parseFloat(downloads) || 0,
          thumbnailPath: thumbnailExists ? thumbnailPath : '',
          notePath,
          isInstalled: false
        }

        games.push(gameInfo)
      } catch (error) {
        console.error('Error parsing game line:', line, error)
      }
    }

    this.decorateAndUpdateSnapshot(games)
    this.games = games
    console.log(`Loaded ${games.length} games`)
  }

  async forceSync(): Promise<GameInfo[]> {
    await this.syncGameData()
    return this.games
  }

  getGames(): Promise<GameInfo[]> {
    return Promise.resolve(this.games)
  }

  getBlacklistGames(): Promise<BlacklistEntry[]> {
    return Promise.resolve(this.customBlacklistGames)
  }

  getLastSyncTime(): Promise<Date | null> {
    return Promise.resolve(this.vrpConfig?.lastSync || null)
  }

  // Added method to expose VRP config needed by DownloadService
  getVrpConfig(): Promise<{ baseUri?: string; password?: string } | null> {
    if (!this.vrpConfig) {
      console.warn('Attempted to get VRP config before it was loaded.')
      return Promise.resolve(null)
    }
    // Return only necessary parts, don't expose lastSync etc.
    return Promise.resolve({
      baseUri: this.vrpConfig.baseUri,
      password: this.vrpConfig.password
    })
  }

  /**
   * Returns the note for a release. Lookup order:
   *
   *   1. User-local `userData/custom-notes.json` - lets the user/dev
   *      override or test notes without rebuilding the app.
   *   2. App-bundled `resources/custom-notes.json` (copied to
   *      <resourcesPath>/custom-notes.json by electron-builder) - notes
   *      authored by the dev that ship to every user.
   *   3. The server-bundled note at vrp-data/.meta/notes/<release>.txt.
   *
   * Empty string means "no source had anything."
   *
   * Both custom-notes files are flat JSON maps:
   *   { "<release name>": "...note text..." }
   *
   * Keys starting with "_" are ignored (so we can leave breadcrumbs /
   * documentation entries in the bundled file).
   *
   * The note text supports `run: <label> | <shell command>` lines that
   * the renderer turns into clickable buttons, and bare URLs that
   * become external links.
   */
  async getNote(releaseName: string): Promise<string> {
    if (releaseName.startsWith('_')) {
      // Underscore keys are reserved for inline docs; never let one
      // accidentally resolve to a real note.
      return ''
    }

    const userNote = await this.readCustomNote(this.customNotesPath, releaseName)
    if (userNote) return userNote

    const bundledPath = app.isPackaged
      ? join(process.resourcesPath, 'custom-notes.json')
      : join(app.getAppPath(), 'resources', 'custom-notes.json')
    const bundledNote = await this.readCustomNote(bundledPath, releaseName)
    if (bundledNote) return bundledNote

    const notePath = join(this.metaPath, 'notes', `${releaseName}.txt`)
    try {
      return await fs.readFile(notePath, 'utf-8')
    } catch {
      return ''
    }
  }

  private async readCustomNote(filePath: string, releaseName: string): Promise<string | null> {
    try {
      if (!existsSync(filePath)) return null
      const raw = await fs.readFile(filePath, 'utf-8')
      const map = JSON.parse(raw) as Record<string, string>
      const value = map?.[releaseName]
      if (typeof value === 'string' && value.trim().length > 0) {
        return value
      }
    } catch (err) {
      console.warn(`[GameService] Failed to read custom notes from ${filePath}:`, err)
    }
    return null
  }

  async addToBlacklist(packageName: string, version: number | 'any' = 'any'): Promise<boolean> {
    // Check if game is already in original blacklist
    if (
      this.blacklistGames.includes(packageName) ||
      INTERNAL_BLACKLIST_GAMES.includes(packageName)
    ) {
      return false
    }

    // Check if game is already in custom blacklist with same or higher version
    const existingEntry = this.customBlacklistGames.find(
      (entry) => entry.packageName === packageName
    )
    if (existingEntry) {
      // If existing entry has version 'any', it covers all versions already
      if (existingEntry.version === 'any') {
        return false
      }

      // If we're adding 'any' version or a higher version number, update the entry
      if (
        version === 'any' ||
        (typeof existingEntry.version === 'number' &&
          typeof version === 'number' &&
          version > existingEntry.version)
      ) {
        existingEntry.version = version
        await this.saveCustomBlacklistGames()
        return true
      }

      // Don't add if new version is equal or lower than existing version
      if (
        typeof existingEntry.version === 'number' &&
        typeof version === 'number' &&
        version <= existingEntry.version
      ) {
        return false
      }
    }

    // Add to custom blacklist
    this.customBlacklistGames.push({ packageName, version })

    // Save updated custom blacklist
    await this.saveCustomBlacklistGames()

    return true
  }

  async removeFromBlacklist(packageName: string): Promise<boolean> {
    // Check if the game is in the internal blacklist (can't be removed)
    if (INTERNAL_BLACKLIST_GAMES.includes(packageName)) {
      return false
    }

    // Check if game is in custom blacklist
    const index = this.customBlacklistGames.findIndex((entry) => entry.packageName === packageName)
    if (index === -1) {
      return false
    }

    // Remove from custom blacklist
    this.customBlacklistGames.splice(index, 1)

    // Save updated custom blacklist
    await this.saveCustomBlacklistGames()

    return true
  }

  isGameBlacklisted(packageName: string, version?: number): boolean {
    // Check internal and original blacklist (these block all versions)
    if (
      INTERNAL_BLACKLIST_GAMES.includes(packageName) ||
      this.blacklistGames.includes(packageName)
    ) {
      return true
    }

    // Check custom blacklist with version comparison
    const entry = this.customBlacklistGames.find((entry) => entry.packageName === packageName)
    if (!entry) {
      return false
    }

    // If entry version is 'any', it blocks all versions
    if (entry.version === 'any') {
      return true
    }

    // If no specific version provided for checking, consider it blacklisted
    if (version === undefined) {
      return true
    }

    // Compare versions - only blacklisted if the version we're checking is less than or equal to blacklisted version
    return typeof entry.version === 'number' && version <= entry.version
  }
}

// Helper function to check if a file exists
async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

export default new GameService()
