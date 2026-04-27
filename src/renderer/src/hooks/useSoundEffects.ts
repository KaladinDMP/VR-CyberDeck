import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Storage keys ────────────────────────────────────────────────────────────
export const SOUND_ENABLED_KEY = 'vrcyberdeck:soundEnabled'
export const SOUND_VOLUME_KEY = 'vrcyberdeck:soundVolume'
export const SOUND_PER_NAME_KEY = 'vrcyberdeck:soundPerNameEnabled'

// ─── Sound names ─────────────────────────────────────────────────────────────
// Add new effects here, then drop a matching <name>.{wav,mp3,ogg} into
// resources/sounds/ (bundled) or <userData>/sounds/ (per-user, no rebuild).
export const SOUND_NAMES = ['click', 'type', 'matrix'] as const
export type SoundName = (typeof SOUND_NAMES)[number]

// ─── Persistence ─────────────────────────────────────────────────────────────
function readEnabled(): boolean {
  try {
    const v = localStorage.getItem(SOUND_ENABLED_KEY)
    if (v === null) return true // default ON if any sound is present
    return v === 'true'
  } catch {
    return true
  }
}

function readVolume(): number {
  try {
    const v = localStorage.getItem(SOUND_VOLUME_KEY)
    if (v === null) return 0.5
    const n = parseFloat(v)
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5
  } catch {
    return 0.5
  }
}

function readPerNameEnabled(): Record<SoundName, boolean> {
  const defaults = SOUND_NAMES.reduce(
    (acc, n) => {
      acc[n] = true
      return acc
    },
    {} as Record<SoundName, boolean>
  )
  try {
    const raw = localStorage.getItem(SOUND_PER_NAME_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaults
    const out = { ...defaults }
    for (const n of SOUND_NAMES) {
      if (typeof parsed[n] === 'boolean') out[n] = parsed[n]
    }
    return out
  } catch {
    return defaults
  }
}

// ─── Module-level cache ──────────────────────────────────────────────────────
// Loaded once per session. Each entry is the data URL or null if missing.
const cache: Partial<Record<SoundName, string | null>> = {}
let loadPromise: Promise<void> | null = null

async function loadAll(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    await Promise.all(
      SOUND_NAMES.map(async (name) => {
        try {
          cache[name] = await window.api.app.getSound(name)
        } catch {
          cache[name] = null
        }
      })
    )
  })()
  return loadPromise
}

// Module-level mutable knobs so the global click handler stays in sync
// without needing to read React state.
let currentEnabled = readEnabled()
let currentVolume = readVolume()
let currentPerName = readPerNameEnabled()

export function playSound(name: SoundName): void {
  if (!currentEnabled) return
  if (currentPerName[name] === false) return
  const url = cache[name]
  if (!url) return
  try {
    const a = new Audio(url)
    a.volume = currentVolume
    void a.play().catch(() => {
      /* autoplay blocked / decode error — ignore */
    })
  } catch {
    /* ignore */
  }
}

/**
 * Like playSound, but only fires if no copy of the same sound has played
 * within the last `windowMs` milliseconds. Used by the boot-intro typing
 * track so a multi-second clip plays once over the whole sequence rather
 * than restarting on every keystroke.
 */
const lastPlayedAt: Partial<Record<SoundName, number>> = {}
export function playSoundOnce(name: SoundName, windowMs: number = 30_000): void {
  const now = Date.now()
  const prev = lastPlayedAt[name] ?? 0
  if (now - prev < windowMs) return
  lastPlayedAt[name] = now
  playSound(name)
}

// ─── React hook ──────────────────────────────────────────────────────────────
export interface SoundSettings {
  enabled: boolean
  volume: number
  loaded: Partial<Record<SoundName, boolean>>
  perName: Record<SoundName, boolean>
  setEnabled: (v: boolean) => void
  setVolume: (v: number) => void
  setPerName: (name: SoundName, enabled: boolean) => void
  play: (name: SoundName) => void
}

export function useSoundEffects(): SoundSettings {
  const [enabled, setEnabledState] = useState<boolean>(() => readEnabled())
  const [volume, setVolumeState] = useState<number>(() => readVolume())
  const [perName, setPerNameState] = useState<Record<SoundName, boolean>>(() => readPerNameEnabled())
  const [loaded, setLoaded] = useState<Partial<Record<SoundName, boolean>>>({})
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    loadAll().then(() => {
      if (!mountedRef.current) return
      const m: Partial<Record<SoundName, boolean>> = {}
      for (const n of SOUND_NAMES) m[n] = !!cache[n]
      setLoaded(m)
    })
    return () => {
      mountedRef.current = false
    }
  }, [])

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v)
    currentEnabled = v
    try {
      localStorage.setItem(SOUND_ENABLED_KEY, String(v))
    } catch {
      /* ignore */
    }
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    setVolumeState(clamped)
    currentVolume = clamped
    try {
      localStorage.setItem(SOUND_VOLUME_KEY, String(clamped))
    } catch {
      /* ignore */
    }
  }, [])

  const setPerName = useCallback((name: SoundName, value: boolean) => {
    setPerNameState((prev) => {
      const next = { ...prev, [name]: value }
      currentPerName = next
      try {
        localStorage.setItem(SOUND_PER_NAME_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { enabled, volume, loaded, perName, setEnabled, setVolume, setPerName, play: playSound }
}

// ─── Bootstrap: kick off loading early so first click already has audio ─────
try {
  void loadAll()
} catch {
  /* ignore */
}
