/**
 * Portable launch bootstrap.
 *
 * When the app runs as a Windows portable build or a Linux AppImage, we want
 * all user data to live next to the executable instead of under the user's
 * AppData / .config. This module:
 *
 *   1. Detects portable mode via env vars electron-builder / AppImage set.
 *   2. On first run, picks a "home" directory - either the exe's folder if
 *      it looks dedicated, or a freshly created `VR CyberDeck Portable/`
 *      subfolder if the exe was dropped somewhere messy (e.g. Downloads).
 *   3. Creates the data directory and writes a `VRCyberDeck.ini` next to the
 *      exe pinning the absolute path.
 *   4. On subsequent runs, reads the INI and uses the path it specifies.
 *      Deleting the INI is the documented "reset / relocate" trigger.
 *   5. Overrides app.getPath('userData') so every service finds its files in
 *      the portable home without any other code changes.
 *
 * This module is imported for its side effect from main/index.ts BEFORE any
 * service that reads userData at construction time (settingsService,
 * logsService, etc.). ESM evaluates sibling imports in source order, so the
 * side effect runs first.
 */

import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join, resolve } from 'path'

const INI_NAME = 'VRCyberDeck.ini'
const PORTABLE_FOLDER_NAME = 'VR CyberDeck Portable'
const DATA_SUBDIR = 'data'

interface PortableConfig {
  data: string
}

function getPortableExeDir(): string | null {
  // Windows portable target sets PORTABLE_EXECUTABLE_DIR to the directory
  // containing the .exe the user launched.
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR
  }
  // Linux AppImage: $APPIMAGE is the AppImage's filesystem path. $APPDIR is
  // the mount point for the squashfs and is NOT what we want here.
  if (process.env.APPIMAGE) {
    return dirname(process.env.APPIMAGE)
  }
  return null
}

function readIni(iniPath: string): PortableConfig | null {
  try {
    if (!existsSync(iniPath)) return null
    const raw = readFileSync(iniPath, 'utf-8')
    let inPaths = false
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith(';') || line.startsWith('#')) continue
      const sec = line.match(/^\[([^\]]+)\]$/)
      if (sec) {
        inPaths = sec[1].trim().toLowerCase() === 'paths'
        continue
      }
      if (!inPaths) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq).trim().toLowerCase()
      const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
      if (key === 'data' && value) return { data: resolve(value) }
    }
    return null
  } catch {
    return null
  }
}

function writeIni(iniPath: string, dataDir: string): void {
  const body = [
    '; VR CyberDeck portable config - auto-generated.',
    '; Delete this file (or move the .exe to an empty folder) to recreate',
    '; the data folder somewhere else on next launch.',
    '',
    '[paths]',
    `data=${dataDir}`,
    ''
  ].join('\r\n')
  try {
    writeFileSync(iniPath, body, 'utf-8')
  } catch (err) {
    console.error('[Portable] Failed to write INI:', err)
  }
}

function looksMessy(exeDir: string, ourEntries: Set<string>): boolean {
  try {
    const entries = readdirSync(exeDir)
    for (const name of entries) {
      const lower = name.toLowerCase()
      if (ourEntries.has(lower)) continue
      // Ignore OS-generated noise.
      if (lower === 'desktop.ini' || lower === '.ds_store' || lower === 'thumbs.db') continue
      // Anything else means the folder is shared with unrelated stuff.
      return true
    }
    return false
  } catch {
    // If we can't read the folder we have no signal - default to nesting,
    // which is the safer choice (won't litter someone else's directory).
    return true
  }
}

function bootstrap(): void {
  const exeDir = getPortableExeDir()
  if (!exeDir) return

  const iniPath = join(exeDir, INI_NAME)
  const existing = readIni(iniPath)
  let dataDir: string

  if (existing) {
    dataDir = existing.data
  } else {
    const ourEntries = new Set<string>([
      INI_NAME.toLowerCase(),
      PORTABLE_FOLDER_NAME.toLowerCase(),
      DATA_SUBDIR.toLowerCase()
    ])
    if (process.env.PORTABLE_EXECUTABLE_FILE) {
      ourEntries.add(basename(process.env.PORTABLE_EXECUTABLE_FILE).toLowerCase())
    }
    if (process.env.APPIMAGE) {
      ourEntries.add(basename(process.env.APPIMAGE).toLowerCase())
    }

    // If the exe is already inside a "VR CyberDeck Portable" folder, treat
    // that as ours and don't nest a second time.
    const alreadyHomed = basename(exeDir).toLowerCase() === PORTABLE_FOLDER_NAME.toLowerCase()

    if (alreadyHomed || !looksMessy(exeDir, ourEntries)) {
      dataDir = join(exeDir, DATA_SUBDIR)
    } else {
      dataDir = join(exeDir, PORTABLE_FOLDER_NAME, DATA_SUBDIR)
    }

    try {
      mkdirSync(dataDir, { recursive: true })
    } catch (err) {
      console.error('[Portable] Failed to create data dir:', err)
      return
    }
    writeIni(iniPath, dataDir)
  }

  try {
    mkdirSync(dataDir, { recursive: true })
  } catch {
    /* best effort - if it really can't be created the next service will surface a clearer error */
  }

  app.setPath('userData', dataDir)
  console.log(`[Portable] userData pinned to ${dataDir}`)
}

bootstrap()
