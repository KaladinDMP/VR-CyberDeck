import { app, shell } from 'electron'
import { EventEmitter } from 'events'
import axios from 'axios'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { UpdateInfo, UpdateProgressInfo } from '@shared/types'
import { compareVersions } from 'compare-versions'

const RELEASE_REPO_OWNER = 'KaladinDMP'
const RELEASE_REPO_NAME = 'apprenticeVrSrc'

const REPO_URL = `https://github.com/${RELEASE_REPO_OWNER}/${RELEASE_REPO_NAME}`
const RELEASES_LATEST_URL = `${REPO_URL}/releases/latest`
const GITHUB_API_LATEST = `https://api.github.com/repos/${RELEASE_REPO_OWNER}/${RELEASE_REPO_NAME}/releases/latest`

interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
  size: number
  content_type: string
}

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  html_url: string
  draft: boolean
  prerelease: boolean
  assets: GitHubReleaseAsset[]
}

class UpdateService extends EventEmitter {
  private currentVersion: string = app.getVersion()
  private pendingAssetUrl: string | null = null
  private downloadedFilePath: string | null = null
  private isDownloading: boolean = false

  constructor() {
    super()
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public initialize(): void {}

  private async fetchLatestRelease(): Promise<GitHubRelease | null> {
    try {
      const response = await axios.get<GitHubRelease>(GITHUB_API_LATEST, {
        headers: {
          Accept: 'application/vnd.github+json',
          'Cache-Control': 'no-cache'
        },
        timeout: 10000
      })

      if (response.status !== 200 || !response.data?.tag_name) {
        console.warn('[UpdateService] GitHub API returned unexpected response:', response.status)
        return null
      }

      return response.data
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('[UpdateService] No published release found on GitHub yet.')
        return null
      }
      console.error('[UpdateService] Error fetching latest release:', error)
      return null
    }
  }

  /**
   * Picks the best release asset for the running platform and architecture.
   *
   * Windows: prefer NSIS setup installer (detects NSIS install by execPath),
   *          fall back to portable, then any .exe for the right arch.
   * macOS:   prefer .dmg for the running arch (x64 or arm64).
   * Linux:   prefer .AppImage (most universal), fall back to .deb.
   *
   * If the exact arch isn't found we fall back to x64 as the safest guess.
   */
  private findAssetForCurrentPlatform(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
    if (assets.length === 0) return null

    const platform = process.platform // 'win32' | 'darwin' | 'linux'
    const arch = process.arch // 'x64' | 'ia32' | 'arm64'

    const find = (predicate: (a: GitHubReleaseAsset) => boolean): GitHubReleaseAsset | undefined =>
      assets.find(predicate)

    if (platform === 'win32') {
      const execLower = process.execPath.toLowerCase()
      const looksLikeNsis =
        execLower.includes('program files') || execLower.includes('appdata\\local\\programs')

      if (looksLikeNsis) {
        const nsisAsset =
          find(
            (a) =>
              a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup') && a.name.includes(arch)
          ) ??
          find((a) => a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup'))
        if (nsisAsset) return nsisAsset
      }

      // Portable (or NSIS fallback)
      return (
        find(
          (a) =>
            a.name.endsWith('.exe') && a.name.toLowerCase().includes('portable') && a.name.includes(arch)
        ) ??
        find((a) => a.name.endsWith('.exe') && a.name.includes(arch)) ??
        find((a) => a.name.endsWith('.exe')) ??
        null
      )
    }

    if (platform === 'darwin') {
      return (
        find((a) => a.name.endsWith('.dmg') && a.name.includes(arch)) ??
        find((a) => a.name.endsWith('.dmg')) ??
        null
      )
    }

    if (platform === 'linux') {
      return (
        find((a) => a.name.endsWith('.AppImage') && a.name.includes(arch)) ??
        find((a) => a.name.endsWith('.AppImage')) ??
        find((a) => a.name.endsWith('.deb') && a.name.includes(arch)) ??
        find((a) => a.name.endsWith('.deb')) ??
        null
      )
    }

    return null
  }

  public async checkForUpdates(): Promise<void> {
    console.log('[UpdateService] Checking for updates via GitHub Releases API...')

    try {
      this.emit('checking-for-update')

      const release = await this.fetchLatestRelease()

      if (!release) {
        console.log('[UpdateService] Could not determine latest version; skipping.')
        return
      }

      const latestVersion = release.tag_name.replace(/^v/i, '')
      console.log(
        `[UpdateService] Current: ${this.currentVersion}, latest release: ${latestVersion}`
      )

      if (compareVersions(latestVersion, this.currentVersion) > 0) {
        const asset = this.findAssetForCurrentPlatform(release.assets || [])

        if (asset) {
          this.pendingAssetUrl = asset.browser_download_url
          console.log(`[UpdateService] Matched asset: ${asset.name} (${asset.browser_download_url})`)
        } else {
          this.pendingAssetUrl = null
          console.warn(
            `[UpdateService] No asset found for platform=${process.platform} arch=${process.arch}. ` +
              `Available assets: ${(release.assets || []).map((a) => a.name).join(', ')}`
          )
        }

        const updateInfo: UpdateInfo = {
          version: latestVersion,
          releaseNotes: release.body || undefined,
          releaseDate: release.published_at || undefined,
          downloadUrl: release.html_url,
          assetUrl: asset?.browser_download_url,
          isConnectivityCheck: true
        }

        this.emit('update-available', updateInfo)
      } else {
        console.log('[UpdateService] No updates available.')
      }
    } catch (error) {
      console.error('[UpdateService] Error checking for updates:', error)
      this.emit('error', error)
    }
  }

  /** Begin downloading the matched release asset. Progress is emitted as 'download-progress'. */
  public async startDownload(): Promise<void> {
    if (!this.pendingAssetUrl) {
      console.warn('[UpdateService] startDownload called but no asset URL is pending.')
      return
    }
    if (this.isDownloading) {
      console.warn('[UpdateService] Download already in progress, ignoring duplicate call.')
      return
    }
    await this.downloadAsset(this.pendingAssetUrl)
  }

  private async downloadAsset(url: string): Promise<void> {
    this.isDownloading = true

    const filename = url.split('/').pop()?.split('?')[0] || 'apprenticevr-update'
    const destPath = path.join(app.getPath('temp'), filename)

    console.log(`[UpdateService] Downloading ${url}\n  → ${destPath}`)

    try {
      const response = await axios.get<NodeJS.ReadableStream>(url, {
        responseType: 'stream',
        maxRedirects: 10,
        timeout: 60_000,
        headers: {
          'User-Agent': `ApprenticeVR-Updater/${this.currentVersion}`
        }
      })

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      let downloadedBytes = 0
      let lastEmitTime = Date.now()
      let lastEmitBytes = 0

      const writer = fs.createWriteStream(destPath)

      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length
        const now = Date.now()
        const elapsedSec = (now - lastEmitTime) / 1000

        if (elapsedSec >= 0.4) {
          const bps = elapsedSec > 0 ? (downloadedBytes - lastEmitBytes) / elapsedSec : 0
          const pct = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0

          const progress: UpdateProgressInfo = {
            bytesPerSecond: Math.round(bps),
            percent: Math.min(Math.round(pct * 10) / 10, 99), // cap at 99 until file is flushed
            transferred: downloadedBytes,
            total: totalBytes
          }

          this.emit('download-progress', progress)
          lastEmitTime = now
          lastEmitBytes = downloadedBytes
        }
      })

      response.data.pipe(writer)

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', (err) => {
          console.error('[UpdateService] File write error:', err)
          reject(err)
        })
        response.data.on('error', (err) => {
          console.error('[UpdateService] Download stream error:', err)
          reject(err)
        })
      })

      // Emit final 100% progress
      this.emit('download-progress', {
        bytesPerSecond: 0,
        percent: 100,
        transferred: downloadedBytes,
        total: totalBytes || downloadedBytes
      } satisfies UpdateProgressInfo)

      this.downloadedFilePath = destPath
      console.log(`[UpdateService] Download complete: ${destPath}`)

      this.emit('update-downloaded', {
        version: this.pendingAssetUrl ?? '',
        downloadUrl: url,
        assetUrl: url
      } satisfies UpdateInfo)
    } catch (error) {
      console.error('[UpdateService] Download failed:', error)
      // Remove partial file
      try {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
      } catch {
        // ignore
      }
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.isDownloading = false
    }
  }

  /**
   * Launch the downloaded installer and (on Windows) quit so NSIS can replace files.
   * On Linux, makes the AppImage executable before opening.
   */
  public async installUpdate(): Promise<void> {
    if (!this.downloadedFilePath) {
      console.warn('[UpdateService] installUpdate called but no file has been downloaded.')
      return
    }

    const filePath = this.downloadedFilePath
    console.log(`[UpdateService] Launching installer: ${filePath}`)

    try {
      if (process.platform === 'linux' && filePath.endsWith('.AppImage')) {
        await fsp.chmod(filePath, '755')
      }

      const openError = await shell.openPath(filePath)
      if (openError) {
        console.error('[UpdateService] shell.openPath failed:', openError)
        this.emit('error', new Error(`Failed to launch installer: ${openError}`))
        return
      }

      // Give the installer a moment to start, then quit so it can replace our files
      if (process.platform === 'win32') {
        setTimeout(() => app.quit(), 800)
      }
    } catch (error) {
      console.error('[UpdateService] installUpdate error:', error)
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
    }
  }

  public openDownloadPage(url: string): void {
    console.log('[UpdateService] Opening download page:', url)
    shell.openExternal(url)
  }

  public openReleasesPage(): void {
    console.log('[UpdateService] Opening releases page:', RELEASES_LATEST_URL)
    shell.openExternal(RELEASES_LATEST_URL)
  }

  public openRepositoryPage(): void {
    console.log('[UpdateService] Opening repository page:', REPO_URL)
    shell.openExternal(REPO_URL)
  }
}

export default new UpdateService()
