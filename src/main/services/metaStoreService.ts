import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import axios from 'axios'

/**
 * Resolves trailer URLs for VRP games.
 *
 * History: This used to scrape Meta Store experience pages for an `og:video`
 * mp4 hosted on Oculus CDN. Meta migrated those pages (and the search page)
 * to a fully client-rendered Facebook shell, so the raw HTML no longer
 * contains either experience IDs or og:video tags - every lookup returned
 * null. We now resolve trailers via YouTube search instead, which still
 * server-renders enough metadata to extract a video ID, and YouTube playback
 * already works inside our pre-configured `persist:youtube` <webview>.
 *
 * Resolution order:
 *   1. Cache hit (persisted to disk by package name)
 *   2. Manual override file (vrp-data/trailer-overrides.json)
 *   3. YouTube search by "<game name> oculus quest trailer"
 *   4. YouTube search by "<game name> trailer" (broader)
 *   5. Null - caller renders "no trailer available"
 *
 * The returned URL is one of:
 *   - "https://www.youtube.com/watch?v=<id>": render in <webview>. We use the
 *     real watch page rather than /embed/ because YouTube's embed pathway
 *     refuses a lot of music/publisher trailers with error 152 ("video
 *     unavailable"); the watch page has no such restriction. The renderer
 *     hides the surrounding chrome via insertCSS on the webview's
 *     dom-ready event so only the player is visible.
 *   - "<direct mp4 URL>": render in <video> (only via overrides).
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const YT_SEARCH_URL = 'https://www.youtube.com/results'
// First videoId in the SSR'd JSON blob is the top result.
const YT_VIDEO_ID_RE = /"videoId":"([a-zA-Z0-9_-]{11})"/

interface CacheEntry {
  trailerUrl: string | null
  resolvedAt: number
}

interface OverrideEntry {
  /** Direct mp4 URL, full YouTube/Meta URL, or null to mean "no trailer" */
  url?: string | null
  /** Convenience: just a YouTube video id, we'll build the embed URL */
  youtubeId?: string
}

const CACHE_VERSION = 3 // bumps invalidate stale entries (v2 stored embed URLs)

class MetaStoreService {
  private cache: Map<string, CacheEntry> = new Map()
  private overrides: Map<string, OverrideEntry> = new Map()
  private cachePath: string
  private overridesPath: string
  private loaded: Promise<void>

  constructor() {
    const dataDir = join(app.getPath('userData'), 'vrp-data')
    this.cachePath = join(dataDir, 'meta-trailer-cache.json')
    this.overridesPath = join(dataDir, 'trailer-overrides.json')
    this.loaded = this.load()
  }

  private async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.cachePath, 'utf-8')
      const obj = JSON.parse(raw) as { __version?: number } & Record<string, CacheEntry>
      if (obj.__version === CACHE_VERSION) {
        for (const [k, v] of Object.entries(obj)) {
          if (k === '__version') continue
          this.cache.set(k, v as CacheEntry)
        }
      }
    } catch {
      /* fresh cache */
    }
    try {
      const raw = await fs.readFile(this.overridesPath, 'utf-8')
      const obj = JSON.parse(raw) as Record<string, OverrideEntry | string | null>
      for (const [k, v] of Object.entries(obj)) {
        if (v === null) this.overrides.set(k, { url: null })
        else if (typeof v === 'string') this.overrides.set(k, { url: v })
        else this.overrides.set(k, v)
      }
    } catch {
      /* no overrides */
    }
  }

  private async persistCache(): Promise<void> {
    const obj: Record<string, CacheEntry | number> = { __version: CACHE_VERSION }
    for (const [k, v] of this.cache) obj[k] = v
    try {
      await fs.mkdir(join(app.getPath('userData'), 'vrp-data'), { recursive: true })
      await fs.writeFile(this.cachePath, JSON.stringify(obj, null, 2))
    } catch (err) {
      console.warn('[MetaStoreService] Failed to persist trailer cache:', err)
    }
  }

  private buildYoutubeWatchUrl(videoId: string): string {
    // Watch page (not /embed/) - the embed pathway gets rejected for many
    // game/publisher trailers with error 152. The renderer hides the chrome
    // around the player with insertCSS on dom-ready.
    return `https://www.youtube.com/watch?v=${videoId}`
  }

  public async getTrailerUrl(
    gameName: string,
    packageName: string | undefined
  ): Promise<string | null> {
    await this.loaded
    const cacheKey = packageName || gameName
    if (!cacheKey) return null

    const override = packageName ? this.overrides.get(packageName) : undefined
    if (override) {
      if (override.url === null) return null
      if (override.youtubeId) return this.buildYoutubeWatchUrl(override.youtubeId)
      if (override.url) {
        // Normalise any youtube.com/watch or youtu.be link to our canonical
        // watch URL form. Other URLs (mp4 etc.) pass through untouched.
        const ytWatch = override.url.match(
          /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        )
        if (ytWatch) return this.buildYoutubeWatchUrl(ytWatch[1])
        return override.url
      }
    }

    const cached = this.cache.get(cacheKey)
    if (cached) return cached.trailerUrl

    let trailerUrl: string | null = null
    try {
      // Prefer Quest-specific results, then fall back to a broader query.
      const baseName = (gameName || '').replace(/[^\w\s-]/g, ' ').trim()
      const queries = baseName
        ? [
            `${baseName} oculus quest trailer`,
            `${baseName} meta quest trailer`,
            `${baseName} trailer`
          ]
        : []
      for (const q of queries) {
        const id = await this.searchYoutubeVideoId(q)
        if (id) {
          trailerUrl = this.buildYoutubeWatchUrl(id)
          break
        }
      }
    } catch (err) {
      console.warn('[MetaStoreService] Trailer lookup failed:', err)
    }

    this.cache.set(cacheKey, { trailerUrl, resolvedAt: Date.now() })
    void this.persistCache()
    return trailerUrl
  }

  private async searchYoutubeVideoId(query: string): Promise<string | null> {
    if (!query.trim()) return null
    try {
      const response = await axios.get<string>(YT_SEARCH_URL, {
        params: { search_query: query, sp: 'EgIQAQ%253D%253D' /* type=video filter */ },
        timeout: 10_000,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      })
      const html = typeof response.data === 'string' ? response.data : ''
      const match = html.match(YT_VIDEO_ID_RE)
      return match ? match[1] : null
    } catch (err) {
      console.warn(`[MetaStoreService] YouTube search failed for "${query}":`, err)
      return null
    }
  }
}

export default new MetaStoreService()
