import { useCallback, useEffect, useState } from 'react'

// ─── Storage keys ────────────────────────────────────────────────────────────
// Existing key kept for backwards compatibility with App.tsx boot check
export const INTRO_STORAGE_KEY = 'vrcyberdeck:showIntro'
export const BREACH_STORAGE_KEY = 'vrcyberdeck:showBreach'
export const MATRIX_SHELL_STORAGE_KEY = 'vrcyberdeck:showMatrixShell'
export const DISABLE_ALL_EXTRAS_KEY = 'vrcyberdeck:disableAllExtras'
export const DISABLE_AUTO_UPDATE_KEY = 'vrcyberdeck:disableAutoUpdate'
export const FONT_SCALE_KEY = 'vrcyberdeck:fontScale'
export const DELETE_ON_REMOVE_KEY = 'vrcyberdeck:deleteOnRemove'
export const DISABLE_SIDELOADING_KEY = 'vrcyberdeck:disableSideloading'
export const COLORBLIND_MODE_KEY = 'vrcyberdeck:colorblindMode'
export const ACCENT_COLOR_KEY = 'vrcyberdeck:accentColor'
export const FONT_FAMILY_KEY = 'vrcyberdeck:fontFamily'

export type DeleteOnRemove = 'ask' | 'delete' | 'keep'

// ─── Font family options ─────────────────────────────────────────────────────
export type FontFamilyChoice = 'cyberpunk' | 'console' | 'terminal' | 'system'

export const FONT_FAMILY_OPTIONS: Record<
  FontFamilyChoice,
  { label: string; stack: string; hint: string }
> = {
  cyberpunk: {
    label: 'Cyberpunk',
    stack: "'Courier New', Courier, monospace",
    hint: 'Default — classic terminal feel'
  },
  console: {
    label: 'Console',
    stack: "Consolas, Monaco, 'DejaVu Sans Mono', monospace",
    hint: 'Cleaner monospace, easier on the eyes'
  },
  terminal: {
    label: 'Terminal',
    stack: "'Lucida Console', 'SF Mono', Menlo, monospace",
    hint: 'Wider letterforms — most readable'
  },
  system: {
    label: 'System Mono',
    stack: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    hint: 'Whatever your OS uses for code'
  }
}

const DEFAULT_FONT_FAMILY: FontFamilyChoice = 'cyberpunk'

// ─── Readers (safe defaults) ────────────────────────────────────────────────
function readBool(key: string, defaultTrue = true): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return defaultTrue
    return v === 'true'
  } catch {
    return defaultTrue
  }
}

function readNumber(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function readDeleteOnRemove(): DeleteOnRemove {
  try {
    const v = localStorage.getItem(DELETE_ON_REMOVE_KEY)
    if (v === 'delete' || v === 'keep' || v === 'ask') return v
  } catch { /* ignore */ }
  return 'ask'
}

export function getDeleteOnRemove(): DeleteOnRemove {
  return readDeleteOnRemove()
}

export function getSideloadingDisabled(): boolean {
  return readBool(DISABLE_SIDELOADING_KEY, false)
}

export function getColorblindMode(): boolean {
  return readBool(COLORBLIND_MODE_KEY, false)
}

export function getAccentColor(): string | null {
  try {
    return localStorage.getItem(ACCENT_COLOR_KEY)
  } catch {
    return null
  }
}

export function getFontFamilyChoice(): FontFamilyChoice {
  try {
    const v = localStorage.getItem(FONT_FAMILY_KEY)
    if (v && v in FONT_FAMILY_OPTIONS) return v as FontFamilyChoice
  } catch { /* ignore */ }
  return DEFAULT_FONT_FAMILY
}

export function applyFontFamily(choice: FontFamilyChoice): void {
  try {
    const stack = FONT_FAMILY_OPTIONS[choice]?.stack ?? FONT_FAMILY_OPTIONS[DEFAULT_FONT_FAMILY].stack
    document.documentElement.style.setProperty('--vrcd-font-mono', stack)
  } catch { /* ignore */ }
}

// Convert "#RRGGBB" → "R, G, B" raw triple for use in rgba()
function hexToRgbRaw(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export function applyAccentColor(hex: string | null): void {
  try {
    const root = document.documentElement
    if (!hex) {
      root.style.removeProperty('--vrcd-neon')
      root.style.removeProperty('--vrcd-neon-raw')
      return
    }
    const raw = hexToRgbRaw(hex)
    if (!raw) return
    root.style.setProperty('--vrcd-neon', hex)
    root.style.setProperty('--vrcd-neon-raw', raw)
  } catch { /* ignore */ }
}

// ─── Bootstrap helpers (called outside React, e.g. in App.tsx) ─────────────
export function shouldShowIntro(): boolean {
  // Master disable wins
  if (readBool(DISABLE_ALL_EXTRAS_KEY, false)) return false
  return readBool(INTRO_STORAGE_KEY, true)
}

export function shouldShowBreach(): boolean {
  if (readBool(DISABLE_ALL_EXTRAS_KEY, false)) return false
  return readBool(BREACH_STORAGE_KEY, true)
}

export function shouldShowMatrixShell(): boolean {
  if (readBool(DISABLE_ALL_EXTRAS_KEY, false)) return false
  return readBool(MATRIX_SHELL_STORAGE_KEY, true)
}

export function isAutoUpdateDisabled(): boolean {
  return readBool(DISABLE_AUTO_UPDATE_KEY, false)
}

export function getFontScale(): number {
  const n = readNumber(FONT_SCALE_KEY, 1)
  return Math.max(0.75, Math.min(2.0, n))
}

// ─── React hook for Settings UI ─────────────────────────────────────────────
export interface ExtrasSettings {
  showIntro: boolean
  showBreach: boolean
  showMatrixShell: boolean
  disableAllExtras: boolean
  disableAutoUpdate: boolean
  fontScale: number
  deleteOnRemove: DeleteOnRemove
  disableSideloading: boolean
  colorblindMode: boolean
  accentColor: string | null
  fontFamily: FontFamilyChoice
  setShowIntro: (v: boolean) => void
  setShowBreach: (v: boolean) => void
  setShowMatrixShell: (v: boolean) => void
  setDisableAllExtras: (v: boolean) => void
  setDisableAutoUpdate: (v: boolean) => void
  setFontScale: (v: number) => void
  setDeleteOnRemove: (v: DeleteOnRemove) => void
  setDisableSideloading: (v: boolean) => void
  setColorblindMode: (v: boolean) => void
  setAccentColor: (v: string | null) => void
  setFontFamily: (v: FontFamilyChoice) => void
}

export function useExtrasSettings(): ExtrasSettings {
  const [showIntro, setShowIntroState] = useState<boolean>(() => readBool(INTRO_STORAGE_KEY, true))
  const [showBreach, setShowBreachState] = useState<boolean>(() => readBool(BREACH_STORAGE_KEY, true))
  const [showMatrixShell, setShowMatrixShellState] = useState<boolean>(() => readBool(MATRIX_SHELL_STORAGE_KEY, true))
  const [disableAllExtras, setDisableAllExtrasState] = useState<boolean>(() => readBool(DISABLE_ALL_EXTRAS_KEY, false))
  const [disableAutoUpdate, setDisableAutoUpdateState] = useState<boolean>(() => readBool(DISABLE_AUTO_UPDATE_KEY, false))
  const [fontScale, setFontScaleState] = useState<number>(() => getFontScale())
  const [deleteOnRemove, setDeleteOnRemoveState] = useState<DeleteOnRemove>(readDeleteOnRemove)
  const [disableSideloading, setDisableSideloadingState] = useState<boolean>(() => readBool(DISABLE_SIDELOADING_KEY, false))
  const [colorblindMode, setColorblindModeState] = useState<boolean>(() => readBool(COLORBLIND_MODE_KEY, false))
  const [accentColor, setAccentColorState] = useState<string | null>(() => getAccentColor())
  const [fontFamily, setFontFamilyState] = useState<FontFamilyChoice>(() => getFontFamilyChoice())

  const persistBool = (key: string, value: boolean): void => {
    try { localStorage.setItem(key, String(value)) } catch { /* ignore */ }
  }

  const persistNumber = (key: string, value: number): void => {
    try { localStorage.setItem(key, String(value)) } catch { /* ignore */ }
  }

  const setShowIntro = useCallback((v: boolean) => { setShowIntroState(v); persistBool(INTRO_STORAGE_KEY, v) }, [])
  const setShowBreach = useCallback((v: boolean) => { setShowBreachState(v); persistBool(BREACH_STORAGE_KEY, v) }, [])
  const setShowMatrixShell = useCallback((v: boolean) => { setShowMatrixShellState(v); persistBool(MATRIX_SHELL_STORAGE_KEY, v) }, [])
  const setDisableAllExtras = useCallback((v: boolean) => { setDisableAllExtrasState(v); persistBool(DISABLE_ALL_EXTRAS_KEY, v) }, [])
  const setDisableAutoUpdate = useCallback((v: boolean) => { setDisableAutoUpdateState(v); persistBool(DISABLE_AUTO_UPDATE_KEY, v) }, [])
  const setFontScale = useCallback((v: number) => {
    const clamped = Math.max(0.75, Math.min(2.0, v))
    setFontScaleState(clamped)
    persistNumber(FONT_SCALE_KEY, clamped)
    try { window.api.app.setZoomFactor(clamped) } catch { /* ignore */ }
  }, [])
  const setDeleteOnRemove = useCallback((v: DeleteOnRemove) => {
    setDeleteOnRemoveState(v)
    try { localStorage.setItem(DELETE_ON_REMOVE_KEY, v) } catch { /* ignore */ }
  }, [])
  const setDisableSideloading = useCallback((v: boolean) => {
    setDisableSideloadingState(v)
    persistBool(DISABLE_SIDELOADING_KEY, v)
    // Mirror to the main process - the auto-install pipeline lives there
    // and otherwise has no way to see this flag.
    try {
      window.api.downloads.setSideloadingDisabled(v)
    } catch { /* ignore */ }
  }, [])
  const setColorblindMode = useCallback((v: boolean) => {
    setColorblindModeState(v)
    persistBool(COLORBLIND_MODE_KEY, v)
    try {
      if (v) document.documentElement.classList.add('vrcd-colorblind')
      else document.documentElement.classList.remove('vrcd-colorblind')
    } catch { /* ignore */ }
  }, [])
  const setAccentColor = useCallback((v: string | null) => {
    setAccentColorState(v)
    try {
      if (v === null) localStorage.removeItem(ACCENT_COLOR_KEY)
      else localStorage.setItem(ACCENT_COLOR_KEY, v)
    } catch { /* ignore */ }
    applyAccentColor(v)
  }, [])
  const setFontFamily = useCallback((v: FontFamilyChoice) => {
    setFontFamilyState(v)
    try { localStorage.setItem(FONT_FAMILY_KEY, v) } catch { /* ignore */ }
    applyFontFamily(v)
  }, [])

  // Live-apply font scale whenever it changes
  useEffect(() => {
    try {
      document.documentElement.style.setProperty('--vrcd-font-scale', String(fontScale))
    } catch { /* ignore */ }
  }, [fontScale])

  // Keep html class in sync with state and override inline CSS vars so the
  // colorblind palette wins over any accent-color inline styles.
  useEffect(() => {
    try {
      const root = document.documentElement
      if (colorblindMode) {
        root.classList.add('vrcd-colorblind')
        root.style.setProperty('--vrcd-neon', '#f0f0f0')
        root.style.setProperty('--vrcd-neon-raw', '240, 240, 240')
        root.style.setProperty('--vrcd-purple', '#ff8c00')
        root.style.setProperty('--vrcd-purple-raw', '255, 140, 0')
      } else {
        root.classList.remove('vrcd-colorblind')
        root.style.removeProperty('--vrcd-purple')
        root.style.removeProperty('--vrcd-purple-raw')
        applyAccentColor(accentColor)
      }
    } catch { /* ignore */ }
  }, [colorblindMode, accentColor])

  return {
    showIntro, showBreach, showMatrixShell, disableAllExtras, disableAutoUpdate, fontScale, deleteOnRemove, disableSideloading, colorblindMode, accentColor, fontFamily,
    setShowIntro, setShowBreach, setShowMatrixShell, setDisableAllExtras, setDisableAutoUpdate, setFontScale, setDeleteOnRemove, setDisableSideloading, setColorblindMode, setAccentColor, setFontFamily
  }
}

// Apply font scale and colorblind mode on initial module load
try {
  const initial = getFontScale()
  document.documentElement.style.setProperty('--vrcd-font-scale', String(initial))
  window.api.app.setZoomFactor(initial)
} catch { /* ignore */ }

try {
  if (getColorblindMode()) {
    const root = document.documentElement
    root.classList.add('vrcd-colorblind')
    root.style.setProperty('--vrcd-neon', '#f0f0f0')
    root.style.setProperty('--vrcd-neon-raw', '240, 240, 240')
    root.style.setProperty('--vrcd-purple', '#ff8c00')
    root.style.setProperty('--vrcd-purple-raw', '255, 140, 0')
  }
} catch { /* ignore */ }

try {
  applyFontFamily(getFontFamilyChoice())
} catch { /* ignore */ }

try {
  applyAccentColor(getAccentColor())
} catch { /* ignore */ }

// Push the persisted sideloading-disabled flag to the main process at boot
// so the auto-install pipeline honors it before the user touches Settings.
try {
  window.api.downloads.setSideloadingDisabled(getSideloadingDisabled())
} catch { /* ignore */ }
