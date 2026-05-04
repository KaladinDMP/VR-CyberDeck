import { contextBridge, IpcRendererEvent, ipcRenderer, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  GameInfo,
  DeviceInfo,
  DependencyStatus,
  DownloadItem,
  DownloadProgress,
  AdbAPIRenderer,
  GameAPIRenderer,
  DownloadAPIRenderer,
  SettingsAPIRenderer,
  PackageInfo,
  UploadPreparationProgress,
  UploadAPIRenderer,
  UploadItem,
  UpdateInfo,
  UpdateProgressInfo,
  UpdateAPIRenderer,
  DependencyAPIRenderer,
  LogsAPIRenderer,
  MirrorAPIRenderer,
  Mirror,
  ServerConfigInfo,
  WiFiBookmark,
  LocalUploadError,
  AppLanguage
} from '@shared/types'
import { typedIpcRenderer } from '@shared/ipc-utils'

const api = {
  app: {
    getVersion: (): Promise<string> => typedIpcRenderer.invoke('app:get-version'),
    getLocale: (): Promise<string> => typedIpcRenderer.invoke('app:get-locale'),
    getSystemUsername: (): Promise<string> => typedIpcRenderer.invoke('app:get-system-username'),
    setZoomFactor: (factor: number): void => webFrame.setZoomFactor(factor),
    confirmClose: (): void => typedIpcRenderer.send('app:confirm-close'),
    getSound: (name: string): Promise<string | null> =>
      typedIpcRenderer.invoke('app:get-sound', name),
    onCloseRequested: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      typedIpcRenderer.on('app:close-requested', listener)
      return () => typedIpcRenderer.removeListener('app:close-requested', listener)
    }
  },
  dependency: {
    getStatus: (): Promise<DependencyStatus> => typedIpcRenderer.invoke('dependency:get-status')
  } satisfies DependencyAPIRenderer,
  adb: {
    listDevices: (): Promise<DeviceInfo[]> => typedIpcRenderer.invoke('adb:list-devices'),
    connectDevice: (serial: string): Promise<boolean> =>
      typedIpcRenderer.invoke('adb:connect-device', serial),
    connectTcpDevice: (ipAddress: string, port?: number): Promise<boolean> =>
      typedIpcRenderer.invoke('adb:connect-tcp-device', ipAddress, port),
    disconnectTcpDevice: (ipAddress: string, port?: number): Promise<boolean> =>
      typedIpcRenderer.invoke('adb:disconnect-tcp-device', ipAddress, port),
    getInstalledPackages: (serial: string): Promise<PackageInfo[]> =>
      typedIpcRenderer.invoke('adb:get-installed-packages', serial),
    uninstallPackage: (serial: string, packageName: string): Promise<boolean> =>
      typedIpcRenderer.invoke('adb:uninstallPackage', serial, packageName),
    pingDevice: (ipAddress: string): Promise<{ reachable: boolean; responseTime?: number }> =>
      typedIpcRenderer.invoke('adb:ping-device', ipAddress),
    startTrackingDevices: (): void => typedIpcRenderer.send('adb:start-tracking-devices'),
    stopTrackingDevices: (): void => typedIpcRenderer.send('adb:stop-tracking-devices'),
    onDeviceAdded: (callback: (device: DeviceInfo) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, device: DeviceInfo): void => callback(device)
      typedIpcRenderer.on('adb:device-added', listener)
      return () => typedIpcRenderer.removeListener('adb:device-added', listener)
    },
    onDeviceRemoved: (callback: (device: DeviceInfo) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, device: DeviceInfo): void => callback(device)
      typedIpcRenderer.on('adb:device-removed', listener)
      return () => typedIpcRenderer.removeListener('adb:device-removed', listener)
    },
    onDeviceChanged: (callback: (device: DeviceInfo) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, device: DeviceInfo): void => callback(device)
      typedIpcRenderer.on('adb:device-changed', listener)
      return () => typedIpcRenderer.removeListener('adb:device-changed', listener)
    },
    onTrackerError: (callback: (error: string) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, error: string): void => callback(error)
      typedIpcRenderer.on('adb:device-tracker-error', listener)
      return () => typedIpcRenderer.removeListener('adb:device-tracker-error', listener)
    },
    onInstallationCompleted: (callback: (deviceId: string) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, deviceId: string): void => callback(deviceId)
      typedIpcRenderer.on('adb:installation-completed', listener)
      return () => typedIpcRenderer.removeListener('adb:installation-completed', listener)
    },
    getApplicationLabel: (serial: string, packageName: string): Promise<string | null> =>
      typedIpcRenderer.invoke('adb:get-application-label', serial, packageName),
    getUserName: (serial: string): Promise<string> =>
      typedIpcRenderer.invoke('adb:get-user-name', serial),
    setUserName: (serial: string, name: string): Promise<void> =>
      typedIpcRenderer.invoke('adb:set-user-name', serial, name),
    getDeviceIp: (serial: string): Promise<string | null> =>
      typedIpcRenderer.invoke('adb:get-device-ip', serial),
    runShellCommand: (serial: string, command: string): Promise<string | null> =>
      typedIpcRenderer.invoke('adb:run-shell-command', serial, command),
    runLocalAdbCommand: (args: string): Promise<string> =>
      typedIpcRenderer.invoke('adb:run-local-adb-command', args)
  } satisfies AdbAPIRenderer,
  games: {
    getGames: (): Promise<GameInfo[]> => typedIpcRenderer.invoke('games:get-games'),
    getBlacklistGames: () => typedIpcRenderer.invoke('games:get-blacklist-games'),
    getNote: (releaseName: string): Promise<string> =>
      typedIpcRenderer.invoke('games:get-note', releaseName),
    getLastSyncTime: (): Promise<Date | null> =>
      typedIpcRenderer.invoke('games:get-last-sync-time'),
    forceSync: (): Promise<GameInfo[]> => typedIpcRenderer.invoke('games:force-sync-games'),
    getTrailerUrl: (
      gameName: string,
      packageName: string | undefined
    ): Promise<string | null> =>
      typedIpcRenderer.invoke('games:get-trailer-url', gameName, packageName),
    onDownloadProgress: (callback: (progress: DownloadProgress) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, progress: DownloadProgress): void => callback(progress)
      typedIpcRenderer.on('games:download-progress', listener)
      return () => typedIpcRenderer.removeListener('games:download-progress', listener)
    },
    addToBlacklist: (packageName: string, version?: number | 'any'): Promise<boolean> =>
      typedIpcRenderer.invoke('games:add-to-blacklist', packageName, version),
    removeFromBlacklist: (packageName: string): Promise<boolean> =>
      typedIpcRenderer.invoke('games:remove-from-blacklist', packageName),
    isGameBlacklisted: (packageName: string, version?: number): Promise<boolean> =>
      typedIpcRenderer.invoke('games:is-game-blacklisted', packageName, version)
  } satisfies GameAPIRenderer,
  // Download Queue APIs
  downloads: {
    getQueue: (): Promise<DownloadItem[]> => typedIpcRenderer.invoke('download:get-queue'),
    addToQueue: (game) => typedIpcRenderer.invoke('download:add', game),
    addToQueueResolveExisting: (game, action) =>
      typedIpcRenderer.invoke('download:add-resolve-existing', game, action),
    removeFromQueue: (releaseName: string): Promise<void> =>
      typedIpcRenderer.invoke('download:remove', releaseName),
    removeFromQueueOnly: (releaseName: string): Promise<void> =>
      typedIpcRenderer.invoke('download:remove-only', releaseName),
    scanDownloadFolder: (): Promise<{ added: number; pruned: number }> =>
      typedIpcRenderer.invoke('download:scan'),
    cancelUserRequest: (releaseName: string): void =>
      typedIpcRenderer.send('download:cancel', releaseName),
    retryDownload: (releaseName: string): void =>
      typedIpcRenderer.send('download:retry', releaseName),
    pauseDownload: (releaseName: string): void =>
      typedIpcRenderer.send('download:pause', releaseName),
    resumeDownload: (releaseName: string): void =>
      typedIpcRenderer.send('download:resume', releaseName),
    deleteDownloadedFiles: (releaseName: string): Promise<boolean> =>
      typedIpcRenderer.invoke('download:delete-files', releaseName),
    installFromCompleted: (releaseName: string, deviceId: string): Promise<void> =>
      typedIpcRenderer.invoke('download:install-from-completed', releaseName, deviceId),
    installManualFile: (filePath: string, deviceId: string): Promise<boolean> =>
      typedIpcRenderer.invoke('downloads:install-manual', filePath, deviceId),
    copyObbFolder: (folderPath: string, deviceId: string): Promise<boolean> =>
      typedIpcRenderer.invoke('downloads:copy-obb-folder', folderPath, deviceId),
    onQueueUpdated: (callback: (queue: DownloadItem[]) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, queue: DownloadItem[]): void => callback(queue)
      typedIpcRenderer.on('download:queue-updated', listener)
      return () => typedIpcRenderer.removeListener('download:queue-updated', listener)
    },
    setDownloadPath: (path: string): void =>
      typedIpcRenderer.send('download:set-download-path', path),
    setAppConnectionState: (selectedDevice: string | null, isConnected: boolean): void =>
      ipcRenderer.send('download:set-app-connection-state', selectedDevice, isConnected),
    setSideloadingDisabled: (disabled: boolean): void =>
      typedIpcRenderer.send('download:set-sideloading-disabled', disabled)
  } satisfies DownloadAPIRenderer,
  // Upload APIs
  uploads: {
    prepareUpload: (
      packageName: string,
      gameName: string,
      versionCode: number,
      deviceId: string
    ): Promise<string | null> =>
      typedIpcRenderer.invoke('upload:prepare', packageName, gameName, versionCode, deviceId),
    getQueue: (): Promise<UploadItem[]> => typedIpcRenderer.invoke('upload:get-queue'),
    addToQueue: (
      packageName: string,
      gameName: string,
      versionCode: number,
      deviceId: string
    ): Promise<boolean> =>
      typedIpcRenderer.invoke('upload:add-to-queue', packageName, gameName, versionCode, deviceId),
    removeFromQueue: (packageName: string): void =>
      typedIpcRenderer.send('upload:remove', packageName),
    cancelUpload: (packageName: string): void =>
      typedIpcRenderer.send('upload:cancel', packageName),
    addLocalItemsToQueue: (paths: string[]): Promise<{ errors: LocalUploadError[] }> =>
      typedIpcRenderer.invoke('upload:add-local-items', paths),
    onUploadProgress: (callback: (progress: UploadPreparationProgress) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, progress: UploadPreparationProgress): void =>
        callback(progress)
      typedIpcRenderer.on('upload:progress', listener)
      return () => typedIpcRenderer.removeListener('upload:progress', listener)
    },
    onQueueUpdated: (callback: (queue: UploadItem[]) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, queue: UploadItem[]): void => callback(queue)
      typedIpcRenderer.on('upload:queue-updated', listener)
      return () => typedIpcRenderer.removeListener('upload:queue-updated', listener)
    }
  } satisfies UploadAPIRenderer,
  // Update APIs
  updates: {
    checkForUpdates: (): Promise<void> => typedIpcRenderer.invoke('update:check-for-updates'),
    openDownloadPage: (url: string): void => typedIpcRenderer.send('update:download', url),
    openReleasesPage: (): void => typedIpcRenderer.send('update:open-releases'),
    openRepositoryPage: (): void => typedIpcRenderer.send('update:open-repository'),
    startDownload: (): void => typedIpcRenderer.send('update:start-download'),
    installUpdate: (): void => typedIpcRenderer.send('update:install'),
    onCheckingForUpdate: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      typedIpcRenderer.on('update:checking-for-update', listener)
      return () => typedIpcRenderer.removeListener('update:checking-for-update', listener)
    },
    onUpdateAvailable: (callback: (info: UpdateInfo) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, info: UpdateInfo): void => callback(info)
      typedIpcRenderer.on('update:update-available', listener)
      return () => typedIpcRenderer.removeListener('update:update-available', listener)
    },
    onUpdateError: (callback: (error: Error) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, error: Error): void => callback(error)
      typedIpcRenderer.on('update:error', listener)
      return () => typedIpcRenderer.removeListener('update:error', listener)
    },
    onDownloadProgress: (callback: (progressInfo: UpdateProgressInfo) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, progressInfo: UpdateProgressInfo): void =>
        callback(progressInfo)
      typedIpcRenderer.on('update:download-progress', listener)
      return () => typedIpcRenderer.removeListener('update:download-progress', listener)
    },
    onUpdateDownloaded: (callback: (updateInfo: UpdateInfo) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, updateInfo: UpdateInfo): void => callback(updateInfo)
      typedIpcRenderer.on('update:update-downloaded', listener)
      return () => typedIpcRenderer.removeListener('update:update-downloaded', listener)
    }
  } satisfies UpdateAPIRenderer,
  settings: {
    getDownloadPath: (): Promise<string> => typedIpcRenderer.invoke('settings:get-download-path'),
    setDownloadPath: (path: string): Promise<void> =>
      typedIpcRenderer.invoke('settings:set-download-path', path),
    getDownloadSpeedLimit: (): Promise<number> =>
      typedIpcRenderer.invoke('settings:get-download-speed-limit'),
    setDownloadSpeedLimit: (limit: number): Promise<void> =>
      typedIpcRenderer.invoke('settings:set-download-speed-limit', limit),
    getUploadSpeedLimit: (): Promise<number> =>
      typedIpcRenderer.invoke('settings:get-upload-speed-limit'),
    setUploadSpeedLimit: (limit: number): Promise<void> =>
      typedIpcRenderer.invoke('settings:set-upload-speed-limit', limit),
    getColorScheme: (): Promise<'light' | 'dark'> =>
      typedIpcRenderer.invoke('settings:get-color-scheme'),
    setColorScheme: (scheme: 'light' | 'dark'): Promise<void> =>
      typedIpcRenderer.invoke('settings:set-color-scheme', scheme),
    getServerConfig: (): Promise<ServerConfigInfo> =>
      typedIpcRenderer.invoke('settings:get-server-config'),
    setServerConfig: (config: ServerConfigInfo): Promise<void> =>
      typedIpcRenderer.invoke('settings:set-server-config', config),
    getLanguage: (): Promise<AppLanguage> => typedIpcRenderer.invoke('settings:get-language'),
    setLanguage: (lang: AppLanguage): Promise<void> =>
      typedIpcRenderer.invoke('settings:set-language', lang),
    getMaxConcurrentDownloads: (): Promise<number> =>
      typedIpcRenderer.invoke('settings:get-max-concurrent-downloads'),
    setMaxConcurrentDownloads: (n: number): Promise<void> =>
      typedIpcRenderer.invoke('settings:set-max-concurrent-downloads', n),
    getExistingDownloadAction: () =>
      typedIpcRenderer.invoke('settings:get-existing-download-action'),
    setExistingDownloadAction: (v) =>
      typedIpcRenderer.invoke('settings:set-existing-download-action', v)
  } satisfies SettingsAPIRenderer,
  // Logs APIs
  logs: {
    uploadCurrentLog: (): Promise<{ url: string; password: string; slug: string } | null> =>
      typedIpcRenderer.invoke('logs:upload-current'),
    openLogFolder: (): Promise<void> => typedIpcRenderer.invoke('logs:open-log-folder'),
    openLogFile: (): Promise<void> => typedIpcRenderer.invoke('logs:open-log-file')
  } satisfies LogsAPIRenderer,
  // Mirror APIs
  mirrors: {
    getMirrors: () => typedIpcRenderer.invoke('mirrors:get-mirrors'),
    addMirror: (configContent: string) =>
      typedIpcRenderer.invoke('mirrors:add-mirror', configContent),
    removeMirror: (id: string) => typedIpcRenderer.invoke('mirrors:remove-mirror', id),
    setActiveMirror: (id: string) => typedIpcRenderer.invoke('mirrors:set-active-mirror', id),
    clearActiveMirror: () => typedIpcRenderer.invoke('mirrors:clear-active-mirror'),
    testMirror: (id: string) => typedIpcRenderer.invoke('mirrors:test-mirror', id),
    testAllMirrors: () => typedIpcRenderer.invoke('mirrors:test-all-mirrors'),
    getActiveMirror: () => typedIpcRenderer.invoke('mirrors:get-active-mirror'),
    importFromFile: () => typedIpcRenderer.invoke('mirrors:import-from-file'),
    onMirrorTestProgress: (
      callback: (id: string, status: 'testing' | 'success' | 'failed', error?: string) => void
    ): (() => void) => {
      const listener = (
        _: IpcRendererEvent,
        id: string,
        status: 'testing' | 'success' | 'failed',
        error?: string
      ): void => callback(id, status, error)
      typedIpcRenderer.on('mirrors:test-progress', listener)
      return () => typedIpcRenderer.removeListener('mirrors:test-progress', listener)
    },
    onMirrorsUpdated: (callback: (mirrors: Mirror[]) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, mirrors: Mirror[]): void => callback(mirrors)
      typedIpcRenderer.on('mirrors:mirrors-updated', listener)
      return () => typedIpcRenderer.removeListener('mirrors:mirrors-updated', listener)
    }
  } satisfies MirrorAPIRenderer,
  // Add dialog API
  dialog: {
    showDirectoryPicker: (): Promise<string | null> =>
      typedIpcRenderer.invoke('dialog:show-directory-picker'),
    showFilePicker: (options?: {
      filters?: { name: string; extensions: string[] }[]
    }): Promise<string | null> => typedIpcRenderer.invoke('dialog:show-file-picker', options),
    showManualInstallPicker: (): Promise<string | null> =>
      typedIpcRenderer.invoke('dialog:show-manual-install-picker'),
    showApkFilePicker: (): Promise<string | null> =>
      typedIpcRenderer.invoke('dialog:show-apk-file-picker'),
    showFolderPicker: (): Promise<string | null> =>
      typedIpcRenderer.invoke('dialog:show-folder-picker'),
    showLocalFolderPicker: (): Promise<string[] | null> =>
      typedIpcRenderer.invoke('dialog:show-local-folder-picker'),
    showLocalZipPicker: (): Promise<string[] | null> =>
      typedIpcRenderer.invoke('dialog:show-local-zip-picker')
  },
  // WiFi bookmarks API
  wifiBookmarks: {
    getAll: (): Promise<WiFiBookmark[]> => typedIpcRenderer.invoke('wifi-bookmarks:get-all'),
    add: (name: string, ipAddress: string, port: number): Promise<boolean> =>
      typedIpcRenderer.invoke('wifi-bookmarks:add', name, ipAddress, port),
    remove: (id: string): Promise<boolean> => typedIpcRenderer.invoke('wifi-bookmarks:remove', id),
    updateLastConnected: (id: string): Promise<void> =>
      typedIpcRenderer.invoke('wifi-bookmarks:update-last-connected', id)
  },
  // Dependency Status Listeners
  onDependencyProgress: (
    callback: (status: DependencyStatus, progress: { name: string; percentage: number }) => void
  ): (() => void) => {
    const listener = (
      _: IpcRendererEvent,
      status: DependencyStatus,
      progress: { name: string; percentage: number }
    ): void => callback(status, progress)
    typedIpcRenderer.on('dependency-progress', listener)
    return () => typedIpcRenderer.removeListener('dependency-progress', listener)
  },
  onDependencySetupComplete: (callback: (status: DependencyStatus) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, status: DependencyStatus): void => callback(status)
    typedIpcRenderer.on('dependency-setup-complete', listener)
    return () => typedIpcRenderer.removeListener('dependency-setup-complete', listener)
  },
  onDependencySetupError: (
    callback: (errorInfo: { message: string; status: DependencyStatus }) => void
  ): (() => void) => {
    const listener = (
      _: IpcRendererEvent,
      errorInfo: { message: string; status: DependencyStatus }
    ): void => callback(errorInfo)
    typedIpcRenderer.on('dependency-setup-error', listener)
    return () => typedIpcRenderer.removeListener('dependency-setup-error', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in d.ts file for type safety)
  window.electron = electronAPI
  // @ts-ignore (define in d.ts file for type safety)
  window.api = api
}
