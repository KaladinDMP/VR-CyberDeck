import { useCallback, useEffect, useState } from 'react'

// ─── Storage keys ────────────────────────────────────────────────────────────
// Existing key kept for backwards compatibility with App.tsx boot check
export const INTRO_STORAGE_KEY = 'vrcyberdeck:showIntro'
export const BREACH_STORAGE_KEY = 'vrcyberdeck:showBreach'
export const MATRIX_SHELL_STORAGE_KEY = 'vrcyberdeck:showMatrixShell'
export const DISABLE_ALL_EXTRAS_KEY = 'vrcyberdeck:disableAllExtras'
export const DISABLE_AUTO_UPDATE_KEY = 'vrcyberdeck:disableAutoUpdate'
export const FONT_SCALE_KEY = 'vrcyberdeck:fontScale'

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
  return Math.max(0.75, Math.min(1.5, n))
}

// ─── React hook for Settings UI ─────────────────────────────────────────────
export interface ExtrasSettings {
  showIntro: boolean
  showBreach: boolean
  showMatrixShell: boolean
  disableAllExtras: boolean
  disableAutoUpdate: boolean
  fontScale: number
  setShowIntro: (v: boolean) => void
  setShowBreach: (v: boolean) => void
  setShowMatrixShell: (v: boolean) => void
  setDisableAllExtras: (v: boolean) => void
  setDisableAutoUpdate: (v: boolean) => void
  setFontScale: (v: number) => void
}

export function useExtrasSettings(): ExtrasSettings {
  const [showIntro, setShowIntroState] = useState<boolean>(() => readBool(INTRO_STORAGE_KEY, true))
  const [showBreach, setShowBreachState] = useState<boolean>(() => readBool(BREACH_STORAGE_KEY, true))
  const [showMatrixShell, setShowMatrixShellState] = useState<boolean>(() => readBool(MATRIX_SHELL_STORAGE_KEY, true))
  const [disableAllExtras, setDisableAllExtrasState] = useState<boolean>(() => readBool(DISABLE_ALL_EXTRAS_KEY, false))
  const [disableAutoUpdate, setDisableAutoUpdateState] = useState<boolean>(() => readBool(DISABLE_AUTO_UPDATE_KEY, false))
  const [fontScale, setFontScaleState] = useState<number>(() => getFontScale())

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
    const clamped = Math.max(0.75, Math.min(1.5, v))
    setFontScaleState(clamped)
    persistNumber(FONT_SCALE_KEY, clamped)
  }, [])

  // Live-apply font scale whenever it changes
  useEffect(() => {
    try {
      document.documentElement.style.setProperty('--vrcd-font-scale', String(fontScale))
    } catch { /* ignore */ }
  }, [fontScale])

  return {
    showIntro, showBreach, showMatrixShell, disableAllExtras, disableAutoUpdate, fontScale,
    setShowIntro, setShowBreach, setShowMatrixShell, setDisableAllExtras, setDisableAutoUpdate, setFontScale
  }
}

// Apply font scale on initial module load so it takes effect before React mounts
try {
  const initial = getFontScale()
  document.documentElement.style.setProperty('--vrcd-font-scale', String(initial))
} catch { /* ignore */ }
