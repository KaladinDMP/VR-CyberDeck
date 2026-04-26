import React, { ReactNode, useEffect, useState, useCallback, useMemo } from 'react'
import { UploadContext, UploadContextType } from './UploadContext'
import { UploadItem, UploadPreparationProgress } from '@shared/types'

interface UploadProviderProps {
  children: ReactNode
}

export const UploadProvider: React.FC<UploadProviderProps> = ({ children }) => {
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [progress, setProgress] = useState<UploadPreparationProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [queue, setQueue] = useState<UploadItem[]>([])

  useEffect(() => {
    let isMounted = true

    // Set up progress listener
    const removeProgressListener = window.api.uploads.onUploadProgress((progressData) => {
      if (isMounted) {
        setProgress(progressData)
        console.log('Upload progress:', progressData)

        // Reset isUploading when upload is complete
        if (progressData.stage === 'Complete') {
          setIsUploading(false)
        } else if (progressData.stage === 'Error') {
          setError('Upload preparation failed')
          setIsUploading(false)
        }
      }
    })

    // Set up queue listener
    const removeQueueListener = window.api.uploads.onQueueUpdated((updatedQueue) => {
      if (isMounted) {
        setQueue(updatedQueue)
        console.log('Upload queue updated:', updatedQueue)
      }
    })

    // Fetch initial queue
    window.api.uploads
      .getQueue()
      .then((initialQueue) => {
        if (isMounted) {
          setQueue(initialQueue)
        }
      })
      .catch((err) => {
        console.error('Error fetching initial upload queue:', err)
      })

    return () => {
      isMounted = false
      removeProgressListener()
      removeQueueListener()
    }
  }, [])

  const prepareUpload = useCallback(
    async (
      packageName: string,
      gameName: string,
      versionCode: number,
      deviceId: string
    ): Promise<string | null> => {
      setError(null)
      setIsUploading(true)

      try {
        const result = await window.api.uploads.prepareUpload(
          packageName,
          gameName,
          versionCode,
          deviceId
        )

        if (!result) {
          setError('Failed to prepare upload')
          setIsUploading(false)
        }

        return result
      } catch (err) {
        console.error('Error preparing upload:', err)
        setError(err instanceof Error ? err.message : 'Unknown error during upload preparation')
        setIsUploading(false)
        return null
      }
    },
    []
  )

  const addToQueue = useCallback(
    async (
      packageName: string,
      gameName: string,
      versionCode: number,
      deviceId: string
    ): Promise<boolean> => {
      try {
        return await window.api.uploads.addToQueue(packageName, gameName, versionCode, deviceId)
      } catch (err) {
        console.error('Error adding to upload queue:', err)
        setError(err instanceof Error ? err.message : 'Unknown error adding to upload queue')
        return false
      }
    },
    []
  )

  const removeFromQueue = useCallback((packageName: string) => {
    try {
      window.api.uploads.removeFromQueue(packageName)
    } catch (err) {
      console.error('Error removing from upload queue:', err)
    }
  }, [])

  const cancelUpload = useCallback((packageName: string) => {
    try {
      window.api.uploads.cancelUpload(packageName)
    } catch (err) {
      console.error('Error cancelling upload:', err)
    }
  }, [])

  const retryUpload = useCallback(
    async (packageName: string): Promise<boolean> => {
      const item = queue.find((i) => i.packageName === packageName)
      if (!item) return false
      try {
        return await window.api.uploads.addToQueue(
          item.packageName,
          item.gameName,
          item.versionCode,
          item.deviceId
        )
      } catch (err) {
        console.error('Error retrying upload:', err)
        return false
      }
    },
    [queue]
  )

  const clearCompleted = useCallback(() => {
    queue
      .filter((i) => i.status === 'Completed' || i.status === 'Cancelled')
      .forEach((i) => {
        try {
          window.api.uploads.removeFromQueue(i.packageName)
        } catch (err) {
          console.error('Error removing completed upload:', err)
        }
      })
  }, [queue])

  const value = useMemo<UploadContextType>(
    () => ({
      isUploading,
      progress,
      error,
      queue,
      addToQueue,
      removeFromQueue,
      cancelUpload,
      retryUpload,
      clearCompleted,
      prepareUpload
    }),
    [isUploading, progress, error, queue, addToQueue, removeFromQueue, cancelUpload, retryUpload, clearCompleted, prepareUpload]
  )

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
}
