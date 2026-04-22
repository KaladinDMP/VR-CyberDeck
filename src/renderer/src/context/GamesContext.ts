import { createContext } from 'react'
import { BlacklistEntry, GameInfo, UploadCandidate } from '@shared/types'

export interface GamesContextType {
  games: GameInfo[]
  localGames: GameInfo[]
  uploadCandidates: UploadCandidate[]
  uploadCandidatesVersion: number
  isLoading: boolean
  error: string | null
  lastSyncTime: Date | null
  downloadProgress: number
  extractProgress: number
  refreshGames: () => Promise<void>
  loadGames: () => Promise<void>
  getNote: (releaseName: string) => Promise<string>
  isInitialLoadComplete: boolean
  getTrailerVideoId: (gameName: string) => Promise<string | null>
  addGameToBlacklist: (packageName: string, version?: number | 'any') => Promise<void>
  getBlacklistGames: () => Promise<BlacklistEntry[]>
  removeGameFromBlacklist: (packageName: string) => Promise<void>
  requestUploadCheck: () => void
}

export const GamesContext = createContext<GamesContextType | undefined>(undefined)
