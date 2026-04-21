import { useState, useCallback } from 'react'

export interface TablePreferences {
  rowDensity: number      // 0 = compact, 100 = comfortable (default 50 ≈ current look)
  alternatingRows: boolean
  evenRowColor: string    // any CSS color string
  oddRowColor: string
  viewMode: 'table' | 'cards'
}

const STORAGE_KEY = 'avr-table-prefs-v1'

const DEFAULTS: TablePreferences = {
  rowDensity: 50,
  alternatingRows: false,
  evenRowColor: 'rgba(0, 212, 255, 0.06)',
  oddRowColor: 'rgba(176, 64, 255, 0.06)',
  viewMode: 'table'
}

function load(): TablePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* corrupt storage */ }
  return { ...DEFAULTS }
}

export function useTablePreferences() {
  const [prefs, setState] = useState<TablePreferences>(load)

  const setPrefs = useCallback((update: Partial<TablePreferences>) => {
    setState((prev) => {
      const next = { ...prev, ...update }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { prefs, setPrefs }
}
