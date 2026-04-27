import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Storage keys ────────────────────────────────────────────────────────────
export const SOUND_ENABLED_KEY = 'vrcyberdeck:soundEnabled'
export const SOUND_VOLUME_KEY = 'vrcyberdeck:soundVolume'

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

export function playSound(name: SoundName): void {
  if (!currentEnabled) return
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

// ─── React hook ──────────────────────────────────────────────────────────────
export interface SoundSettings {
  enabled: boolean
  volume: number
  loaded: Partial<Record<SoundName, boolean>>
  setEnabled: (v: boolean) => void
  setVolume: (v: number) => void
  play: (name: SoundName) => void
}

export function useSoundEffects(): SoundSettings {
  const [enabled, setEnabledState] = useState<boolean>(() => readEnabled())
  const [volume, setVolumeState] = useState<number>(() => readVolume())
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

  return { enabled, volume, loaded, setEnabled, setVolume, play: playSound }
}

// ─── Bootstrap: kick off loading early so first click already has audio ─────
try {
  void loadAll()
} catch {
  /* ignore */
}
