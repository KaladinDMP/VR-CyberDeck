import {
  DeviceInfo,
  GameInfo,
  DownloadItem,
  DownloadProgress,
  DependencyStatus,
  PackageInfo,
  UploadItem,
  UploadPreparationProgress,
  UpdateInfo,
  UpdateProgressInfo,
  BlacklistEntry,
  Mirror,
  MirrorTestResult,
  ServerConfigInfo,
  WiFiBookmark,
  LocalUploadError,
  AppLanguage,
  ExistingDownloadAction,
  AddToQueueResult
} from './index'

// Define types for all IPC channels between renderer and main

/**
 * Helper type for defining a new IPC channel
 * @example
 * // Define a new channel in IPCChannels:
 * 'my-new-channel': DefineChannel<[param1: string, param2: number], boolean>
 */
export type DefineChannel<TParams extends unknown[] = [], TReturn = void> = {
  params: TParams
  returns: TReturn
}

// Interface mapping channel names to their parameter and return types
export interface IPCChannels {
  // Dependency related channels
  'dependency:get-status': DefineChannel<[], DependencyStatus>

  // ADB related channels
  'adb:list-devices': DefineChannel<[], DeviceInfo[]>
  'adb:connect-device': DefineChannel<[serial: string], boolean>
  'adb:connect-tcp-device': DefineChannel<[ipAddress: string, port?: number], boolean>
  'adb:disconnect-tcp-device': DefineChannel<[ipAddress: string, port?: number], boolean>
  'adb:get-device-ip': DefineChannel<[serial: string], string | null>
  'adb:get-installed-packages': DefineChannel<[serial: string], PackageInfo[]>
  'adb:uninstallPackage': DefineChannel<[serial: string, packageName: string], boolean>
  'adb:get-application-label': DefineChannel<[serial: string, packageName: string], string | null>
  'adb:get-user-name': DefineChannel<[serial: string], string>
  'adb:set-user-name': DefineChannel<[serial: string, name: string], void>
  'adb:ping-device': DefineChannel<
    [ipAddress: string],
    { reachable: boolean; responseTime?: number }
  >
  'adb:run-shell-command': DefineChannel<[serial: string, command: string], string | null>
  'adb:run-local-adb-command': DefineChannel<[args: string], string>

  // Game related channels
  'games:get-games': DefineChannel<[], GameInfo[]>
  'games:get-blacklist-games': DefineChannel<[], BlacklistEntry[]>
  'games:add-to-blacklist': DefineChannel<[packageName: string, version?: number | 'any'], boolean>
  'games:remove-from-blacklist': DefineChannel<[packageName: string], boolean>
  'games:is-game-blacklisted': DefineChannel<[packageName: string, version?: number], boolean>
  'games:get-last-sync-time': DefineChannel<[], Date | null>
  'games:force-sync-games': DefineChannel<[], GameInfo[]>
  'games:get-note': DefineChannel<[releaseName: string], string>
  'games:get-trailer-url': DefineChannel<
    [gameName: string, packageName: string | undefined],
    string | null
  >

  // Download related channels
  'download:get-queue': DefineChannel<[], DownloadItem[]>
  'download:add': DefineChannel<[game: GameInfo], AddToQueueResult>
  'download:add-resolve-existing': DefineChannel<
    [game: GameInfo, action: 'reinstall' | 'redownload'],
    AddToQueueResult
  >
  'download:remove': DefineChannel<[releaseName: string], void>
  'download:remove-only': DefineChannel<[releaseName: string], void>
  'download:scan': DefineChannel<[], { added: number; pruned: number }>
  'download:delete-files': DefineChannel<[releaseName: string], boolean>
  'download:install-from-completed': DefineChannel<[releaseName: string, deviceId: string], void>

  // Upload related channels
  'upload:prepare': DefineChannel<
    [packageName: string, gameName: string, versionCode: number, deviceId: string],
    string | null
  >
  'upload:get-queue': DefineChannel<[], UploadItem[]>
  'upload:add-to-queue': DefineChannel<
    [packageName: string, gameName: string, versionCode: number, deviceId: string],
    boolean
  >
  'upload:add-local-items': DefineChannel<[paths: string[]], { errors: LocalUploadError[] }>

  // App info
  'app:get-version': DefineChannel<[], string>
  'app:get-locale': DefineChannel<[], string>
  'app:get-system-username': DefineChannel<[], string>
  'app:get-sound': DefineChannel<[name: string], string | null>

  // Update related channels
  'update:check-for-updates': DefineChannel<[], void>

  // Settings related channels
  'settings:get-download-path': DefineChannel<[], string>
  'settings:set-download-path': DefineChannel<[path: string], void>
  'settings:get-download-speed-limit': DefineChannel<[], number>
  'settings:set-download-speed-limit': DefineChannel<[limit: number], void>
  'settings:get-upload-speed-limit': DefineChannel<[], number>
  'settings:set-upload-speed-limit': DefineChannel<[limit: number], void>
  'settings:get-color-scheme': DefineChannel<[], 'light' | 'dark'>
  'settings:set-color-scheme': DefineChannel<[scheme: 'light' | 'dark'], void>
  'settings:get-server-config': DefineChannel<[], ServerConfigInfo>
  'settings:set-server-config': DefineChannel<[config: ServerConfigInfo], void>
  'settings:get-language': DefineChannel<[], AppLanguage>
  'settings:set-language': DefineChannel<[lang: AppLanguage], void>
  'settings:get-max-concurrent-downloads': DefineChannel<[], number>
  'settings:set-max-concurrent-downloads': DefineChannel<[n: number], void>
  'settings:get-existing-download-action': DefineChannel<[], ExistingDownloadAction>
  'settings:set-existing-download-action': DefineChannel<[v: ExistingDownloadAction], void>

  // Log upload related channels
  'logs:upload-current': DefineChannel<[], { url: string; password: string; slug: string } | null>
  'logs:open-log-folder': DefineChannel<[], void>
  'logs:open-log-file': DefineChannel<[], void>

  // Mirror related channels
  'mirrors:get-mirrors': DefineChannel<[], Mirror[]>
  'mirrors:add-mirror': DefineChannel<[configContent: string], boolean>
  'mirrors:remove-mirror': DefineChannel<[id: string], boolean>
  'mirrors:set-active-mirror': DefineChannel<[id: string], boolean>
  'mirrors:clear-active-mirror': DefineChannel<[], boolean>
  'mirrors:test-mirror': DefineChannel<[id: string], MirrorTestResult>
  'mirrors:test-all-mirrors': DefineChannel<[], MirrorTestResult[]>
  'mirrors:get-active-mirror': DefineChannel<[], Mirror | null>
  'mirrors:import-from-file': DefineChannel<[], string | null>

  // WiFi bookmark related channels
  'wifi-bookmarks:get-all': DefineChannel<[], WiFiBookmark[]>
  'wifi-bookmarks:add': DefineChannel<[name: string, ipAddress: string, port: number], boolean>
  'wifi-bookmarks:remove': DefineChannel<[id: string], boolean>
  'wifi-bookmarks:update-last-connected': DefineChannel<[id: string], void>

  // Dialog related channels
  'dialog:show-directory-picker': DefineChannel<[], string | null>
  'dialog:show-file-picker': DefineChannel<
    [options?: { filters?: { name: string; extensions: string[] }[] }],
    string | null
  >
  'dialog:show-manual-install-picker': DefineChannel<[], string | null>
  'dialog:show-apk-file-picker': DefineChannel<[], string | null>
  'dialog:show-folder-picker': DefineChannel<[], string | null>
  'dialog:show-local-folder-picker': DefineChannel<[], string[] | null>
  'dialog:show-local-zip-picker': DefineChannel<[], string[] | null>

  // Manual installation channels
  'downloads:install-manual': DefineChannel<[filePath: string, deviceId: string], boolean>
  'downloads:copy-obb-folder': DefineChannel<[folderPath: string, deviceId: string], boolean>
}

// Types for send (no response) channels
export interface IPCSendChannels {
  'adb:start-tracking-devices': void
  'adb:stop-tracking-devices': void
  'download:cancel': string
  'download:retry': string
  'download:pause': string
  'download:resume': string
  'download:set-download-path': string
  'download:set-sideloading-disabled': boolean
  'upload:remove': string
  'upload:cancel': string
  'update:download': string
  'update:open-releases': void
  'update:open-repository': void
  'update:start-download': void
  'update:install': void
  'app:confirm-close': void
}

// Types for events emitted from main to renderer
export interface IPCEvents {
  'dependency-progress': [status: DependencyStatus, progress: { name: string; percentage: number }]
  'dependency-setup-complete': [status: DependencyStatus]
  'dependency-setup-error': [errorInfo: { message: string; status: DependencyStatus }]
  'adb:device-added': [device: DeviceInfo]
  'adb:device-removed': [device: DeviceInfo]
  'adb:device-changed': [device: DeviceInfo]
  'adb:device-tracker-error': [error: string]
  'adb:installation-completed': [deviceId: string]
  'games:download-progress': [progress: DownloadProgress]
  'download:queue-updated': [queue: DownloadItem[]]
  'upload:progress': [progress: UploadPreparationProgress]
  'upload:queue-updated': [queue: UploadItem[]]
  'settings:download-speed-limit-changed': [limit: number]
  'settings:upload-speed-limit-changed': [limit: number]
  'update:checking-for-update': []
  'update:update-available': [updateInfo: UpdateInfo]
  'update:error': [error: Error]
  'update:download-progress': [progressInfo: UpdateProgressInfo]
  'update:update-downloaded': [updateInfo: UpdateInfo]
  'mirrors:test-progress': [id: string, status: 'testing' | 'success' | 'failed', error?: string]
  'mirrors:mirrors-updated': [mirrors: Mirror[]]
  'app:close-requested': []
}
