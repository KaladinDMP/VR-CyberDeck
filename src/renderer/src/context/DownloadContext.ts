import { createContext } from 'react'
import { DownloadItem, GameInfo } from '@shared/types'

export interface DownloadContextType {
  queue: DownloadItem[]
  isLoading: boolean
  error: string | null
  addToQueue: (game: GameInfo) => Promise<boolean>
  removeFromQueue: (releaseName: string) => Promise<void>
  removeFromQueueOnly: (releaseName: string) => Promise<void>
  cancelDownload: (releaseName: string) => void
  retryDownload: (releaseName: string) => void
  pauseDownload: (releaseName: string) => void
  resumeDownload: (releaseName: string) => void
  deleteFiles: (releaseName: string) => Promise<boolean>
}

export const DownloadContext = createContext<DownloadContextType | undefined>(undefined)
