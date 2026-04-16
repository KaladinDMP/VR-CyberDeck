import { app, shell } from 'electron'
import { EventEmitter } from 'events'
import axios from 'axios'
import { UpdateInfo } from '@shared/types'
import { compareVersions } from 'compare-versions'

// Repository that publishes the releases this app checks for.
// Changing this single constant re-points the updater (and opened pages) at
// a different fork or mirror.
const RELEASE_REPO_OWNER = 'KaladinDMP'
const RELEASE_REPO_NAME = 'apprenticeVrSrc'
const RELEASE_REPO_BRANCH = 'main'

const REPO_URL = `https://github.com/${RELEASE_REPO_OWNER}/${RELEASE_REPO_NAME}`
const RELEASES_URL = `${REPO_URL}/releases`
const RELEASES_LATEST_URL = `${RELEASES_URL}/latest`
const UPDATE_TXT_URL = `https://raw.githubusercontent.com/${RELEASE_REPO_OWNER}/${RELEASE_REPO_NAME}/${RELEASE_REPO_BRANCH}/update.txt`

class UpdateService extends EventEmitter {
  private currentVersion: string = app.getVersion()

  constructor() {
    super()
  }

  /**
   * Initialize the update service
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public initialize(): void {}

  /**
   * Fetch the latest published version string from the repo's update.txt.
   * Returns null if the file cannot be retrieved or parsed.
   */
  private async fetchLatestVersionFromUpdateTxt(): Promise<string | null> {
    try {
      const response = await axios.get(UPDATE_TXT_URL, {
        // Disable axios response caching on some platforms and bypass CDN caches.
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 10000,
        responseType: 'text',
        transformResponse: [(v): string => String(v ?? '')]
      })

      if (response.status !== 200 || typeof response.data !== 'string') {
        console.warn('update.txt fetch returned non-OK status:', response.status)
        return null
      }

      // Take the first non-empty line and strip whitespace / optional leading 'v'.
      const firstLine = response.data
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)

      if (!firstLine) {
        console.warn('update.txt is empty')
        return null
      }

      return firstLine.replace(/^v/i, '')
    } catch (error) {
      console.error('Error fetching update.txt:', error)
      return null
    }
  }

  /**
   * Check for updates by reading the lightweight update.txt file published
   * alongside releases. Emits 'update-available' with isConnectivityCheck=true
   * when a newer version is found so the UI can render the "you might be
   * missing a fix" popup the user asked for.
   */
  public async checkForUpdates(): Promise<void> {
    console.log('Checking for updates via update.txt...')

    try {
      this.emit('checking-for-update')

      const latestVersion = await this.fetchLatestVersionFromUpdateTxt()

      if (!latestVersion) {
        console.log('Could not determine latest version from update.txt; skipping update check.')
        return
      }

      console.log(`Current version: ${this.currentVersion}, update.txt version: ${latestVersion}`)

      if (compareVersions(latestVersion, this.currentVersion) > 0) {
        const updateInfo: UpdateInfo = {
          version: latestVersion,
          // Point the "Download Update" button at the releases/latest page so users
          // always land on the freshest published assets.
          downloadUrl: RELEASES_LATEST_URL,
          isConnectivityCheck: true
        }
        this.emit('update-available', updateInfo)
      } else {
        console.log('No updates available')
      }
    } catch (error) {
      console.error('Error checking for updates:', error)
      this.emit('error', error)
    }
  }

  /**
   * Open download URL in browser
   */
  public openDownloadPage(url: string): void {
    console.log('Opening download page:', url)
    shell.openExternal(url)
  }

  /**
   * Open the releases/latest page in browser
   */
  public openReleasesPage(): void {
    console.log('Opening releases page:', RELEASES_LATEST_URL)
    shell.openExternal(RELEASES_LATEST_URL)
  }

  /**
   * Open repository page in browser
   */
  public openRepositoryPage(): void {
    console.log('Opening repository page:', REPO_URL)
    shell.openExternal(REPO_URL)
  }
}

export default new UpdateService()
