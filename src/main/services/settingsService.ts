import {
  Settings,
  SettingsAPI,
  ServerConfigInfo,
  AppLanguage,
  ExistingDownloadAction,
  WindowBounds
} from '@shared/types'
import { app, nativeTheme } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import EventEmitter from 'events'

// Bundled server — used when no custom config has been saved.
// Update these values here when the server details change.
const BUNDLED_SERVER: ServerConfigInfo = {
  baseUri: 'https://go.srcdl1.xyz/',
  password: 'Z0w1OVZmZ1B4b0hS'
}

class SettingsService extends EventEmitter implements SettingsAPI {
  private settings: Settings
  private settingsPath: string

  constructor() {
    super()
    this.settingsPath = join(app.getPath('userData'), 'settings.json')

    // Detect system language — default to Spanish if system locale starts with 'es'
    const systemLocale = app.getLocale()
    const defaultLanguage: AppLanguage = systemLocale.toLowerCase().startsWith('es') ? 'es' : 'en'

    // Default settings
    this.settings = {
      downloadPath: join(app.getPath('userData'), 'downloads'),
      downloadSpeedLimit: 0,
      uploadSpeedLimit: 0,
      hideAdultContent: true,
      colorScheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      serverConfig: { baseUri: '', password: '' },
      language: defaultLanguage,
      maxConcurrentDownloads: 3,
      existingDownloadAction: 'ask'
    }

    // Load settings from disk
    this.loadSettings()
  }

  getDownloadPath(): string {
    return this.settings.downloadPath
  }

  setDownloadPath(path: string): void {
    this.settings.downloadPath = path
    this.saveSettings()
    this.emit('download-path-changed', path)
  }

  getDownloadSpeedLimit(): number {
    return this.settings.downloadSpeedLimit
  }

  setDownloadSpeedLimit(limit: number): void {
    this.settings.downloadSpeedLimit = limit
    this.saveSettings()
    this.emit('download-speed-limit-changed', limit)
  }

  getUploadSpeedLimit(): number {
    return this.settings.uploadSpeedLimit
  }

  setUploadSpeedLimit(limit: number): void {
    this.settings.uploadSpeedLimit = limit
    this.saveSettings()
    this.emit('upload-speed-limit-changed', limit)
  }

  getColorScheme(): 'light' | 'dark' {
    return this.settings.colorScheme
  }

  setColorScheme(scheme: 'light' | 'dark'): void {
    this.settings.colorScheme = scheme
    this.saveSettings()
    this.emit('color-scheme-changed', scheme)
  }

  getServerConfig(): ServerConfigInfo {
    const uri = this.settings.serverConfig?.baseUri ?? ''
    const pwd = this.settings.serverConfig?.password ?? ''
    // Fall back to the bundled defaults when no config has been explicitly saved
    // (new installs) or the saved values were cleared (empty strings).
    if (!uri || !pwd) {
      return { ...BUNDLED_SERVER }
    }
    return { baseUri: uri, password: pwd }
  }

  setServerConfig(config: ServerConfigInfo): void {
    this.settings.serverConfig = {
      baseUri: config.baseUri ?? '',
      password: config.password ?? ''
    }
    this.saveSettings()
    this.emit('server-config-changed', this.settings.serverConfig)
  }

  getLanguage(): AppLanguage {
    return this.settings.language ?? 'en'
  }

  setLanguage(lang: AppLanguage): void {
    this.settings.language = lang
    this.saveSettings()
    this.emit('language-changed', lang)
  }

  getMaxConcurrentDownloads(): number {
    const n = this.settings.maxConcurrentDownloads ?? 3
    return Math.max(1, Math.min(6, n))
  }

  setMaxConcurrentDownloads(n: number): void {
    this.settings.maxConcurrentDownloads = Math.max(1, Math.min(6, n))
    this.saveSettings()
    this.emit('max-concurrent-downloads-changed', this.settings.maxConcurrentDownloads)
  }

  getExistingDownloadAction(): ExistingDownloadAction {
    return this.settings.existingDownloadAction ?? 'ask'
  }

  setExistingDownloadAction(v: ExistingDownloadAction): void {
    this.settings.existingDownloadAction = v
    this.saveSettings()
    this.emit('existing-download-action-changed', v)
  }

  getWindowBounds(): WindowBounds | undefined {
    return this.settings.windowBounds
  }

  setWindowBounds(bounds: WindowBounds): void {
    this.settings.windowBounds = bounds
    this.saveSettings()
  }

  private loadSettings(): void {
    try {
      const exists = existsSync(this.settingsPath)
      if (exists) {
        const data = readFileSync(this.settingsPath, 'utf-8')
        const loadedSettings = JSON.parse(data)
        this.settings = { ...this.settings, ...loadedSettings }
        console.log('Settings loaded successfully')
      } else {
        console.log('No settings file found, using defaults')
        // Create the settings file with default values
        this.saveSettings()
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  private saveSettings(): void {
    try {
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8')
      console.log('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }
}

export default new SettingsService()
