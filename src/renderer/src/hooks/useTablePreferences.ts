import { useState, useCallback } from 'react'

export interface TablePreferences {
  rowDensity: number      // 0 = compact, 100 = comfortable (default 50 ≈ current look)
  alternatingRows: boolean
  evenRowColor: string    // any CSS color string
  oddRowColor: string
  viewMode: 'table' | 'cards'
}

const STORAGE_KEY = 'avr-table-prefs-v2'
const OLD_KEY = 'avr-table-prefs-v1'

const DEFAULTS: TablePreferences = {
  rowDensity: 50,
  alternatingRows: true,
  evenRowColor: '#050514',
  oddRowColor: 'rgba(57,255,20,0.06)',
  viewMode: 'table'
}

function load(): TablePreferences {
  // Wipe stale v1 data so it can't cause issues
  try { localStorage.removeItem(OLD_KEY) } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TablePreferences>
      // Guard: ensure viewMode is a valid value
      if (parsed.viewMode !== 'table' && parsed.viewMode !== 'cards') {
        parsed.viewMode = 'table'
      }
      return { ...DEFAULTS, ...parsed }
    }
  } catch { /* corrupt storage — start fresh */ }
  return { ...DEFAULTS }
}

export function useTablePreferences() {
  const [prefs, setState] = useState<TablePreferences>(load)

  const setPrefs = useCallback((update: Partial<TablePreferences>) => {
    setState((prev) => {
      const next = { ...prev, ...update }
      // Guard viewMode before saving
      if (next.viewMode !== 'table' && next.viewMode !== 'cards') {
        next.viewMode = 'table'
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { prefs, setPrefs }
}
