import { useState, useCallback } from 'react'

export interface TablePreferences {
  rowDensity: number
  alternatingRows: boolean
  evenRowColor: string
  oddRowColor: string
  viewMode: 'table' | 'cards'
  cardSize: number            // 0=smallest, 100=largest
  cardSortKey: string         // column id or '' for none
  cardSortDir: 'asc' | 'desc'
  tableSortKey: string        // persisted table-mode sort column
  tableSortDir: 'asc' | 'desc'
}

const STORAGE_KEY = 'avr-table-prefs-v5'
const OLD_KEYS = ['avr-table-prefs-v1', 'avr-table-prefs-v2', 'avr-table-prefs-v3', 'avr-table-prefs-v4']

const DEFAULTS: TablePreferences = {
  rowDensity: 50,
  alternatingRows: true,
  evenRowColor: '#050514',
  oddRowColor: 'rgba(57,255,20,0.06)',
  viewMode: 'table',
  cardSize: 50,
  cardSortKey: 'name',
  cardSortDir: 'asc',
  tableSortKey: '',
  tableSortDir: 'asc'
}

function load(): TablePreferences {
  for (const key of OLD_KEYS) {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TablePreferences>
      if (parsed.viewMode !== 'table' && parsed.viewMode !== 'cards') parsed.viewMode = 'table'
      if (parsed.cardSortDir !== 'asc' && parsed.cardSortDir !== 'desc') parsed.cardSortDir = 'asc'
      if (parsed.tableSortDir !== 'asc' && parsed.tableSortDir !== 'desc') parsed.tableSortDir = 'asc'
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
      if (next.viewMode !== 'table' && next.viewMode !== 'cards') next.viewMode = 'table'
      if (next.cardSortDir !== 'asc' && next.cardSortDir !== 'desc') next.cardSortDir = 'asc'
      if (next.tableSortDir !== 'asc' && next.tableSortDir !== 'desc') next.tableSortDir = 'asc'
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { prefs, setPrefs }
}
