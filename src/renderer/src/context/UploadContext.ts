import { createContext } from 'react'
import { UploadItem, UploadPreparationProgress } from '@shared/types'

export interface UploadContextType {
  isUploading: boolean
  progress: UploadPreparationProgress | null
  error: string | null
  queue: UploadItem[]
  addToQueue: (
    packageName: string,
    gameName: string,
    versionCode: number,
    deviceId: string
  ) => Promise<boolean>
  removeFromQueue: (packageName: string) => void
  cancelUpload: (packageName: string) => void
  retryUpload: (packageName: string) => Promise<boolean>
  clearCompleted: () => void
  prepareUpload: (
    packageName: string,
    gameName: string,
    versionCode: number,
    deviceId: string
  ) => Promise<string | null>
}

export const UploadContext = createContext<UploadContextType | undefined>(undefined)
