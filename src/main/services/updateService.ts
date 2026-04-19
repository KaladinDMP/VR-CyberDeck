import { app, shell } from 'electron'
import { EventEmitter } from 'events'
import axios from 'axios'
import { UpdateInfo } from '@shared/types'
import { compareVersions } from 'compare-versions'

const RELEASE_REPO_OWNER = 'KaladinDMP'
const RELEASE_REPO_NAME = 'apprenticeVrSrc'

const REPO_URL = `https://github.com/${RELEASE_REPO_OWNER}/${RELEASE_REPO_NAME}`
const RELEASES_LATEST_URL = `${REPO_URL}/releases/latest`
const GITHUB_API_LATEST = `https://api.github.com/repos/${RELEASE_REPO_OWNER}/${RELEASE_REPO_NAME}/releases/latest`

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  html_url: string
  draft: boolean
  prerelease: boolean
}

class UpdateService extends EventEmitter {
  private currentVersion: string = app.getVersion()

  constructor() {
    super()
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public initialize(): void {}

  /**
   * Fetches the latest published (non-draft, non-prerelease) release from the
   * GitHub Releases API. Returns null if unreachable or no release exists yet.
   * Draft releases are invisible to this endpoint, so users are never nagged
   * about a version that hasn't been published yet.
   */
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
        console.warn('GitHub releases API returned unexpected response:', response.status)
        return null
      }

      return response.data
    } catch (error: unknown) {
      // 404 means no published release exists yet — not an error worth logging loudly
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('No published release found on GitHub yet.')
        return null
      }
      console.error('Error fetching latest release from GitHub API:', error)
      return null
    }
  }

  public async checkForUpdates(): Promise<void> {
    console.log('Checking for updates via GitHub Releases API...')

    try {
      this.emit('checking-for-update')

      const release = await this.fetchLatestRelease()

      if (!release) {
        console.log('Could not determine latest version; skipping update check.')
        return
      }

      const latestVersion = release.tag_name.replace(/^v/i, '')

      console.log(`Current version: ${this.currentVersion}, latest release: ${latestVersion}`)

      if (compareVersions(latestVersion, this.currentVersion) > 0) {
        const updateInfo: UpdateInfo = {
          version: latestVersion,
          releaseNotes: release.body || undefined,
          releaseDate: release.published_at || undefined,
          downloadUrl: release.html_url,
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

  public openDownloadPage(url: string): void {
    console.log('Opening download page:', url)
    shell.openExternal(url)
  }

  public openReleasesPage(): void {
    console.log('Opening releases page:', RELEASES_LATEST_URL)
    shell.openExternal(RELEASES_LATEST_URL)
  }

  public openRepositoryPage(): void {
    console.log('Opening repository page:', REPO_URL)
    shell.openExternal(REPO_URL)
  }
}

export default new UpdateService()
