import geekyUsernames from '../assets/g33kyu$3rn4m3$.json'

const RABBIT_FIRST_LAUNCH_KEY = 'vr-matrix-rabbit-date'
export const USERNAME_PREFS_KEY = 'vr-matrix-usernames'

export interface UsernamePref {
  mode: 'random+custom' | 'only-custom'
  ratio: number
  custom: string[]
}

export function getMatrixUsername(): string {
  const builtInRandom = [
    ...(geekyUsernames?.random ?? []),
    'DMP', 'KaladinDMP', 'n30_h4ck3r', 'v01d_w4lk3r', 'glitch_daemon', 'r00t@cyberdeck'
  ]

  let prefs: UsernamePref = { mode: 'random+custom', ratio: 2, custom: [] }
  try {
    const raw = localStorage.getItem(USERNAME_PREFS_KEY)
    if (raw) prefs = { ...prefs, ...JSON.parse(raw) }
  } catch { /* use defaults */ }

  const { mode, ratio, custom } = prefs
  const hasCustom = custom.length > 0

  if (mode === 'only-custom' && hasCustom) {
    return custom[Math.floor(Math.random() * custom.length)]
  }

  const pool: string[] = [...builtInRandom]
  if (hasCustom) {
    const r = Math.max(1, Math.round(ratio))
    for (let i = 0; i < r; i++) pool.push(...custom)
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? 'n30'
}

export function isFirstLaunchToday(): boolean {
  const today = new Date().toDateString()
  const stored = localStorage.getItem(RABBIT_FIRST_LAUNCH_KEY) ?? ''
  if (stored !== today) {
    localStorage.setItem(RABBIT_FIRST_LAUNCH_KEY, today)
    return true
  }
  return false
}
