import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import axios from 'axios'

/**
 * Resolves Meta (Quest) Store trailer URLs for VRP games.
 *
 * Why this exists: YouTube increasingly returns "video unavailable" inside
 * embedded iframes (error 152), even for trailers that play fine on the
 * regular page. Meta Store experience pages expose the trailer as a plain
 * `og:video` mp4 hosted on Oculus CDN, which we can play in a vanilla
 * <video> tag with no embed restrictions.
 *
 * Resolution order:
 *   1. Cache hit (persisted to disk by package name)
 *   2. Manual override file (vrp-data/trailer-overrides.json)
 *   3. Meta Store search by game name
 *   4. Meta Store search by package name (with .mr. stripped for MR-fix variants)
 *   5. Null → caller renders "no trailer available"
 */

// Pretend to be a normal Chrome on Windows. Some Meta endpoints return a
// stripped/login-walled response to bot-shaped UAs.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const META_SEARCH_URL = 'https://www.meta.com/experiences/section/search/'
// Meta uses hash-style IDs in URL slugs. We just need the digit-string id.
const EXPERIENCE_LINK_RE = /\/experiences\/(?:[^/]+\/)?(\d{6,})\b/g
// og:video / og:video:url / og:video:secure_url all point at the mp4
const OG_VIDEO_RE =
  /<meta\s+property=["']og:video(?::(?:url|secure_url))?["']\s+content=["']([^"']+)["']/i

interface CacheEntry {
  trailerUrl: string | null
  resolvedAt: number
}

interface OverrideEntry {
  // Either a direct mp4 URL, a Meta experience URL, or null to mean "no trailer"
  url?: string | null
  // Convenience: supply just an experience id, we'll build the URL
  experienceId?: string
}

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
      const obj = JSON.parse(raw) as Record<string, CacheEntry>
      for (const [k, v] of Object.entries(obj)) this.cache.set(k, v)
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
    const obj: Record<string, CacheEntry> = {}
    for (const [k, v] of this.cache) obj[k] = v
    try {
      await fs.mkdir(join(app.getPath('userData'), 'vrp-data'), { recursive: true })
      await fs.writeFile(this.cachePath, JSON.stringify(obj, null, 2))
    } catch (err) {
      console.warn('[MetaStoreService] Failed to persist trailer cache:', err)
    }
  }

  /**
   * Some VRP releases append `.mr` to the package for Mixed Reality fix builds
   * (e.g. `com.example.game.mr`). The Meta Store entry is the base game.
   */
  private normalizePackageName(pkg: string): string {
    return pkg.replace(/\.mr(?:\..+)?$/i, '').replace(/\.mr$/i, '')
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
      if (override.url) {
        // If override is an experience URL, resolve to mp4. If already mp4, pass through.
        if (/\.mp4(?:\?|$)/i.test(override.url)) return override.url
        return await this.resolveOgVideo(override.url)
      }
      if (override.experienceId) {
        return await this.resolveOgVideo(
          `https://www.meta.com/experiences/${override.experienceId}/`
        )
      }
    }

    const cached = this.cache.get(cacheKey)
    if (cached) return cached.trailerUrl

    let trailerUrl: string | null = null
    try {
      const experienceUrl =
        (await this.searchExperienceUrl(gameName)) ??
        (packageName
          ? await this.searchExperienceUrl(this.normalizePackageName(packageName))
          : null)

      if (experienceUrl) {
        trailerUrl = await this.resolveOgVideo(experienceUrl)
      }
    } catch (err) {
      console.warn('[MetaStoreService] Trailer lookup failed:', err)
    }

    this.cache.set(cacheKey, { trailerUrl, resolvedAt: Date.now() })
    void this.persistCache()
    return trailerUrl
  }

  private async searchExperienceUrl(query: string): Promise<string | null> {
    if (!query.trim()) return null
    try {
      const response = await axios.get<string>(META_SEARCH_URL, {
        params: { q: query },
        timeout: 10_000,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' }
      })
      const html = typeof response.data === 'string' ? response.data : ''
      const ids = new Set<string>()
      for (const m of html.matchAll(EXPERIENCE_LINK_RE)) ids.add(m[1])
      const first = ids.values().next().value
      if (!first) return null
      return `https://www.meta.com/experiences/${first}/`
    } catch (err) {
      console.warn(`[MetaStoreService] Search failed for "${query}":`, err)
      return null
    }
  }

  private async resolveOgVideo(experienceUrl: string): Promise<string | null> {
    try {
      const response = await axios.get<string>(experienceUrl, {
        timeout: 10_000,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' }
      })
      const html = typeof response.data === 'string' ? response.data : ''
      const match = html.match(OG_VIDEO_RE)
      return match ? match[1] : null
    } catch (err) {
      console.warn(`[MetaStoreService] og:video lookup failed for ${experienceUrl}:`, err)
      return null
    }
  }
}

export default new MetaStoreService()
