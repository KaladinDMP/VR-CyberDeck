import { IpcRenderer } from 'electron'
import {
  AdbAPIRenderer,
  DependencyStatus,
  DownloadAPIRenderer,
  GameAPIRenderer,
  SettingsAPIRenderer,
  UploadAPIRenderer,
  UpdateAPIRenderer,
  DependencyAPIRenderer,
  LogsAPIRenderer,
  MirrorAPIRenderer,
  WiFiBookmark
} from '@shared/types'

declare global {
  interface Window {
    ipcRenderer: IpcRenderer
    api: {
      app: {
        getVersion: () => Promise<string>
        getLocale: () => Promise<string>
        getSystemUsername: () => Promise<string>
        setZoomFactor: (factor: number) => void
        notify: (title: string, body: string) => Promise<void>
      }
      dependency: DependencyAPIRenderer
      adb: AdbAPIRenderer
      games: GameAPIRenderer
      downloads: DownloadAPIRenderer
      settings: SettingsAPIRenderer
      uploads: UploadAPIRenderer
      updates: UpdateAPIRenderer
      logs: LogsAPIRenderer
      mirrors: MirrorAPIRenderer
      dialog: {
        showDirectoryPicker: () => Promise<string | null>
        showFilePicker: (options?: {
          filters?: { name: string; extensions: string[] }[]
        }) => Promise<string | null>
        showManualInstallPicker: () => Promise<string | null>
        showApkFilePicker: () => Promise<string | null>
        showFolderPicker: () => Promise<string | null>
        showLocalFolderPicker: () => Promise<string[] | null>
        showLocalZipPicker: () => Promise<string[] | null>
      }
      wifiBookmarks: {
        getAll: () => Promise<WiFiBookmark[]>
        add: (name: string, ipAddress: string, port: number) => Promise<boolean>
        remove: (id: string) => Promise<boolean>
        updateLastConnected: (id: string) => Promise<void>
      }
      onDependencyProgress: (
        callback: (status: DependencyStatus, progress: { name: string; percentage: number }) => void
      ) => () => void
      onDependencySetupComplete: (callback: (status: DependencyStatus) => void) => () => void
      onDependencySetupError: (
        callback: (errorInfo: { message: string; status: DependencyStatus }) => void
      ) => () => void
    }
  }
}
