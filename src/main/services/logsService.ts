import { app, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import os from 'os'
import { LogsAPI } from '@shared/types'

// Rentry caps POST body size. Log files with lots of brackets, colons, slashes
// encode to 2-3x their raw size as application/x-www-form-urlencoded.
// Keep raw content small enough that the encoded payload stays under the limit.
const MAX_LOG_BYTES = 60 * 1024 // 60 KB raw → ~120 KB URL-encoded, well under limit

// ─── Error-line highlighting ──────────────────────────────────────────────────

/**
 * Returns true when a log line represents a real error worth highlighting.
 *
 * Rules:
 *  - Skip anything that looks like "error: null / undefined / false" — those
 *    are logged-but-empty error slots, not actual failures.
 *  - Highlight lines where electron-log stamped the [error] level.
 *  - Highlight lines that contain a Node.js syscall error code.
 *  - Highlight JavaScript stack-trace lines (leading whitespace + "at ").
 */
function isActualError(line: string): boolean {
  // ── Suppress null / no-op error patterns ────────────────────────────────────
  // Matches: "error: null", "Error: null", ": null" at end of line, etc.
  if (/\berror[:\s]+null\b/i.test(line)) return false
  if (/\berror[:\s]+undefined\b/i.test(line)) return false
  if (/\berror[:\s]+false\b/i.test(line)) return false
  if (/:\s*null\s*$/.test(line.trim())) return false

  // ── Real error signals ───────────────────────────────────────────────────────
  // electron-log stamps the level as [error]
  if (/\[error\]/i.test(line)) return true

  // Node.js syscall error codes that appear inline in messages
  if (/\b(ENOENT|ECONNREFUSED|ETIMEDOUT|EACCES|EPERM|ENOTFOUND|ECONNRESET|EADDRINUSE|EISDIR|EEXIST)\b/.test(line)) return true

  // JavaScript stack-trace lines: "   at functionName (file:line:col)"
  if (/^\s{2,}at\s+\S/.test(line)) return true

  return false
}

/**
 * Wraps every genuine error line in rentry.co's red colour markup.
 * Any literal `%%` inside a line is escaped to `% %` so it can't
 * accidentally close the colour span early.
 */
function annotateErrors(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!isActualError(line)) return line
      // Escape rentry's colour-close token inside the line content
      const safe = line.replace(/%%/g, '% %')
      return `%red%${safe}%%`
    })
    .join('\n')
}

// ─── Persistent rentry config ─────────────────────────────────────────────────

interface RentryConfig {
  slug: string
  url: string
  editCode: string
}

function getRentryConfigPath(): string {
  return join(app.getPath('userData'), 'rentry-config.json')
}

function loadRentryConfig(): RentryConfig | null {
  const configPath = getRentryConfigPath()
  if (!existsSync(configPath)) return null
  try {
    const raw = readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as RentryConfig
  } catch {
    return null
  }
}

function saveRentryConfig(config: RentryConfig): void {
  const configPath = getRentryConfigPath()
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

/** Sanitize the OS username into a valid rentry slug: lowercase a-z0-9_-, max 50 chars. */
function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 50)
}

// ─── Service ──────────────────────────────────────────────────────────────────

class LogsService implements LogsAPI {
  public getLogFilePath(): string {
    return join(app.getPath('userData'), 'logs', 'main.log')
  }

  public getLogFolderPath(): string {
    return join(app.getPath('userData'), 'logs')
  }

  public async openLogFolder(): Promise<void> {
    const folderPath = this.getLogFolderPath()
    console.log('[LogsService] Opening log folder:', folderPath)
    await shell.openPath(folderPath)
  }

  public async openLogFile(): Promise<void> {
    const filePath = this.getLogFilePath()
    console.log('[LogsService] Opening log file:', filePath)
    if (existsSync(filePath)) {
      await shell.openPath(filePath)
    } else {
      console.warn('[LogsService] Log file not found:', filePath)
    }
  }

  async uploadCurrentLog(): Promise<{ url: string; password: string; slug: string } | null> {
    const logFilePath = this.getLogFilePath()

    if (!existsSync(logFilePath)) {
      console.error('[LogsService] Log file not found at:', logFilePath)
      return null
    }

    try {
      console.log('[LogsService] Reading log file...')
      const raw = readFileSync(logFilePath, 'utf-8')

      // Truncate to last MAX_LOG_BYTES if the file is too large
      const trimmed =
        Buffer.byteLength(raw, 'utf-8') > MAX_LOG_BYTES
          ? `[...truncated — showing last ~60 KB...]\n\n${raw.slice(-MAX_LOG_BYTES)}`
          : raw

      // Annotate real error lines with rentry red colour markup
      const content = annotateErrors(trimmed)
      // Plain version used for the random-slug retry (no annotation markup overhead)
      const plainContent = trimmed

      // Step 1: Retrieve CSRF token from rentry.co
      const initResponse = await fetch('https://rentry.co/', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      const setCookieHeader = initResponse.headers.get('set-cookie')
      const csrfMatch = setCookieHeader?.match(/csrftoken=([^;,\s]+)/)
      if (!csrfMatch) {
        throw new Error('Could not retrieve CSRF token from rentry.co')
      }
      const csrfToken = csrfMatch[1]

      // Check if we already have a persistent config to edit
      const existingConfig = loadRentryConfig()

      if (existingConfig) {
        console.log('[LogsService] Attempting to edit existing rentry page:', existingConfig.slug)
        try {
          const editForm = new URLSearchParams()
          editForm.append('csrfmiddlewaretoken', csrfToken)
          editForm.append('edit_code', existingConfig.editCode)
          editForm.append('text', content)

          const editResponse = await fetch(`https://rentry.co/api/edit/${existingConfig.slug}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Cookie: `csrftoken=${csrfToken}`,
              Referer: 'https://rentry.co/'
            },
            body: editForm.toString()
          })

          if (editResponse.ok) {
            const editResult = (await editResponse.json()) as { status: string }
            if (editResult.status === '200') {
              console.log('[LogsService] Existing rentry page updated:', existingConfig.url)
              return { url: existingConfig.url, password: '', slug: existingConfig.slug }
            }
          }
          console.warn('[LogsService] Edit failed, creating a new rentry page')
        } catch (editErr) {
          console.warn('[LogsService] Edit request failed, creating a new rentry page:', editErr)
        }
      }

      // Step 2: Create a new rentry page
      console.log('[LogsService] Uploading log to rentry.co...')

      const formData = new URLSearchParams()
      formData.append('csrfmiddlewaretoken', csrfToken)
      formData.append('text', content)

      // Try the sanitized PC username as the slug on the first upload
      if (!existingConfig) {
        try {
          const rawUsername = os.userInfo().username
          const desiredSlug = sanitizeSlug(rawUsername)
          if (desiredSlug.length >= 2) {
            formData.append('url', desiredSlug)
          }
        } catch {
          // os.userInfo() can fail in some environments; fall back to random slug
        }
      }

      const postResponse = await fetch('https://rentry.co/api/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `csrftoken=${csrfToken}`,
          Referer: 'https://rentry.co/'
        },
        body: formData.toString()
      })

      if (!postResponse.ok) {
        throw new Error(`Rentry API HTTP error: ${postResponse.status} ${postResponse.statusText}`)
      }

      const result = (await postResponse.json()) as {
        status: string
        url: string
        edit_code: string
      }

      if (result.status !== '200') {
        console.warn('[LogsService] First upload attempt failed — status:', result.status, 'content:', (result as Record<string, unknown>).content ?? '')
        // If the desired slug was taken, retry without it to get a random one.
        // Refresh the CSRF token first — rentry.co invalidates the previous token
        // after a non-200 POST, so reusing it returns HTTP 400.
        if (formData.has('url')) {
          console.warn('[LogsService] Desired slug taken, retrying with random slug')

          const refreshResponse = await fetch('https://rentry.co/', {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          })
          const refreshCookie = refreshResponse.headers.get('set-cookie')
          const refreshMatch = refreshCookie?.match(/csrftoken=([^;,\s]+)/)
          const retryCsrf = refreshMatch ? refreshMatch[1] : csrfToken

          const retryForm = new URLSearchParams()
          retryForm.append('csrfmiddlewaretoken', retryCsrf)
          retryForm.append('text', plainContent) // plain text — no annotation markup overhead

          const retryResponse = await fetch('https://rentry.co/api/new', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Cookie: `csrftoken=${retryCsrf}`,
              Referer: 'https://rentry.co/'
            },
            body: retryForm.toString()
          })

          if (!retryResponse.ok) {
            const body = await retryResponse.text().catch(() => '(no body)')
            console.error('[LogsService] Retry response body:', body.slice(0, 500))
            throw new Error(`Rentry API HTTP error: ${retryResponse.status} ${retryResponse.statusText}`)
          }

          const retryResult = (await retryResponse.json()) as {
            status: string
            url: string
            edit_code: string
          }

          if (retryResult.status !== '200') {
            console.error('[LogsService] Retry also failed — status:', retryResult.status, 'content:', (retryResult as Record<string, unknown>).content ?? '')
            throw new Error(`Rentry API returned status ${retryResult.status}`)
          }

          const entryUrl = retryResult.url
          const slug = entryUrl.replace(/^https?:\/\/rentry\.co\//, '')
          saveRentryConfig({ slug, url: entryUrl, editCode: retryResult.edit_code })
          console.log('[LogsService] Log uploaded (random slug):', entryUrl)
          return { url: entryUrl, password: '', slug }
        }

        throw new Error(`Rentry API returned status ${result.status}`)
      }

      const entryUrl = result.url
      const slug = entryUrl.replace(/^https?:\/\/rentry\.co\//, '')
      saveRentryConfig({ slug, url: entryUrl, editCode: result.edit_code })

      console.log('[LogsService] Log uploaded successfully:', entryUrl, '(slug:', slug + ')')
      return { url: entryUrl, password: '', slug }
    } catch (error) {
      console.error('[LogsService] Failed to upload log to rentry.co:', error)
      return null
    }
  }
}

export default new LogsService()
