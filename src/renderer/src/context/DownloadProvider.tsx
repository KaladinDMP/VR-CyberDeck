import React, { ReactNode, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { DownloadContext, DownloadContextType } from './DownloadContext'
import { DownloadItem, GameInfo, ExistingDownloadAction } from '@shared/types'

interface DownloadProviderProps {
  children: ReactNode
}

interface PendingPrompt {
  game: GameInfo
  resolve: (success: boolean) => void
}

export const DownloadProvider: React.FC<DownloadProviderProps> = ({ children }) => {
  const [queue, setQueue] = useState<DownloadItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null)
  const [rememberChoice, setRememberChoice] = useState<boolean>(false)
  // Prevent double-resolving the prompt promise if the user clicks twice
  const resolvedRef = useRef(false)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    window.api.downloads
      .getQueue()
      .then((initialQueue) => {
        if (isMounted) setQueue(initialQueue)
      })
      .catch((err) => {
        console.error('Error fetching initial download queue:', err)
        if (isMounted) setError('Failed to load download queue')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    const removeUpdateListener = window.api.downloads.onQueueUpdated((updatedQueue) => {
      setQueue(updatedQueue)
      setError(null)
    })

    return () => {
      isMounted = false
      removeUpdateListener()
    }
  }, [])

  const addToQueue = useCallback(async (game: GameInfo): Promise<boolean> => {
    console.log(`Context: Adding ${game.releaseName} to queue...`)
    try {
      const result = await window.api.downloads.addToQueue(game)
      if (result === 'added' || result === 'imported') return true
      if (result === 'duplicate') {
        console.warn(
          `Context: Failed to add ${game.releaseName} to queue (likely already present).`
        )
        return false
      }
      // 'needs-prompt' — open the dialog and wait for the user
      resolvedRef.current = false
      setRememberChoice(false)
      return await new Promise<boolean>((resolve) => {
        setPendingPrompt({ game, resolve })
      })
    } catch (err) {
      console.error('Error adding game to download queue via IPC:', err)
      setError(`Failed to add ${game.name} to queue.`)
      return false
    }
  }, [])

  const settleResolveExisting = useCallback(
    async (action: 'reinstall' | 'redownload') => {
      const prompt = pendingPrompt
      if (!prompt || resolvedRef.current) return
      resolvedRef.current = true
      try {
        if (rememberChoice) {
          // Persist the choice so future clicks skip the dialog.
          const settingValue: ExistingDownloadAction = action
          await window.api.settings.setExistingDownloadAction(settingValue)
        }
        const result = await window.api.downloads.addToQueueResolveExisting(prompt.game, action)
        prompt.resolve(result === 'added' || result === 'imported')
      } catch (err) {
        console.error('Error resolving existing-download prompt:', err)
        setError(`Failed to add ${prompt.game.name} to queue.`)
        prompt.resolve(false)
      } finally {
        setPendingPrompt(null)
        setRememberChoice(false)
      }
    },
    [pendingPrompt, rememberChoice]
  )

  const cancelPrompt = useCallback(() => {
    const prompt = pendingPrompt
    if (!prompt || resolvedRef.current) return
    resolvedRef.current = true
    prompt.resolve(false)
    setPendingPrompt(null)
    setRememberChoice(false)
  }, [pendingPrompt])

  const removeFromQueue = useCallback(async (releaseName: string): Promise<void> => {
    try {
      await window.api.downloads.removeFromQueue(releaseName)
    } catch (err) {
      console.error('Error removing game from download queue via IPC:', err)
      setError('Failed to remove item from queue.')
    }
  }, [])

  const removeFromQueueOnly = useCallback(async (releaseName: string): Promise<void> => {
    try {
      await window.api.downloads.removeFromQueueOnly(releaseName)
    } catch (err) {
      console.error('Error removing game from download queue (keep files) via IPC:', err)
      setError('Failed to remove item from queue.')
    }
  }, [])

  const cancelDownload = useCallback((releaseName: string): void => {
    try {
      window.api.downloads.cancelUserRequest(releaseName)
    } catch (err) {
      console.error('Error cancelling download via IPC:', err)
      setError('Failed to cancel download.')
    }
  }, [])

  const retryDownload = useCallback((releaseName: string): void => {
    try {
      window.api.downloads.retryDownload(releaseName)
    } catch (err) {
      console.error('Error retrying download via IPC:', err)
      setError('Failed to retry download.')
    }
  }, [])

  const pauseDownload = useCallback((releaseName: string): void => {
    try {
      window.api.downloads.pauseDownload(releaseName)
    } catch (err) {
      console.error('Error pausing download via IPC:', err)
      setError('Failed to pause download.')
    }
  }, [])

  const resumeDownload = useCallback((releaseName: string): void => {
    try {
      window.api.downloads.resumeDownload(releaseName)
    } catch (err) {
      console.error('Error resuming download via IPC:', err)
      setError('Failed to resume download.')
    }
  }, [])

  const deleteFiles = useCallback(async (releaseName: string): Promise<boolean> => {
    try {
      const success = await window.api.downloads.deleteDownloadedFiles(releaseName)
      if (!success) setError('Failed to delete downloaded files.')
      return success
    } catch (err) {
      console.error('Error deleting downloaded files via IPC:', err)
      setError('Failed to delete downloaded files.')
      return false
    }
  }, [])

  const value = useMemo<DownloadContextType>(
    () => ({
      queue,
      isLoading,
      error,
      addToQueue,
      removeFromQueue,
      removeFromQueueOnly,
      cancelDownload,
      retryDownload,
      pauseDownload,
      resumeDownload,
      deleteFiles
    }),
    [queue, isLoading, error, addToQueue, removeFromQueue, removeFromQueueOnly, cancelDownload, retryDownload, pauseDownload, resumeDownload, deleteFiles]
  )

  return (
    <DownloadContext.Provider value={value}>
      {children}
      {pendingPrompt && (
        <ExistingDownloadPromptDialog
          gameName={pendingPrompt.game.name || pendingPrompt.game.releaseName}
          releaseName={pendingPrompt.game.releaseName}
          remember={rememberChoice}
          onToggleRemember={setRememberChoice}
          onChoose={settleResolveExisting}
          onCancel={cancelPrompt}
        />
      )}
    </DownloadContext.Provider>
  )
}

// ─── Dialog ─────────────────────────────────────────────────────────────────

interface PromptDialogProps {
  gameName: string
  releaseName: string
  remember: boolean
  onToggleRemember: (v: boolean) => void
  onChoose: (action: 'reinstall' | 'redownload') => void
  onCancel: () => void
}

const ExistingDownloadPromptDialog: React.FC<PromptDialogProps> = ({
  gameName,
  releaseName,
  remember,
  onToggleRemember,
  onChoose,
  onCancel
}) => {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(2px)'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#030310',
          border: '1px solid rgba(var(--vrcd-neon-raw),0.45)',
          maxWidth: '560px',
          width: '92vw',
          fontFamily: 'var(--vrcd-font-mono)',
          borderRadius: '8px',
          padding: '24px 28px',
          boxShadow:
            '0 0 50px rgba(var(--vrcd-neon-raw),0.10), 0 0 80px rgba(var(--vrcd-purple-raw),0.08)'
        }}
      >
        <div
          style={{
            fontSize: '18px',
            color: 'var(--vrcd-purple)',
            letterSpacing: '0.1em',
            fontWeight: 700,
            textAlign: 'center',
            textShadow:
              '0 0 10px rgba(var(--vrcd-purple-raw),0.7), 0 0 24px rgba(var(--vrcd-purple-raw),0.3)',
            marginBottom: '14px',
            textTransform: 'uppercase'
          }}
        >
          [ FILES ALREADY ON DISK ]
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--vrcd-neon)',
            lineHeight: 1.6,
            textAlign: 'center',
            textShadow: '0 0 6px rgba(var(--vrcd-neon-raw),0.35)',
            marginBottom: '18px'
          }}
        >
          A complete copy of <strong>{gameName}</strong> already exists in your
          downloads folder.
          <br />
          <span style={{ color: 'rgba(var(--vrcd-neon-raw),0.55)', fontSize: '11px' }}>
            {releaseName}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <PromptButton
            color="neon"
            title="Use the existing files. Skip the download and head straight to install."
            onClick={() => onChoose('reinstall')}
          >
            INSTALL FROM EXISTING FILES
          </PromptButton>
          <PromptButton
            color="purple"
            title="Wipe the existing folder and download a fresh copy from the server."
            onClick={() => onChoose('redownload')}
          >
            RE-DOWNLOAD (REPLACES FILES)
          </PromptButton>
          <PromptButton color="dim" onClick={onCancel}>
            CANCEL
          </PromptButton>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px',
            fontSize: '11px',
            color: 'rgba(var(--vrcd-neon-raw),0.6)',
            cursor: 'pointer',
            justifyContent: 'center'
          }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => onToggleRemember(e.target.checked)}
            style={{ accentColor: 'var(--vrcd-neon)' }}
          />
          Remember my choice (Settings → When download already exists)
        </label>
      </div>
    </div>
  )
}

const PromptButton: React.FC<{
  children: React.ReactNode
  onClick: () => void
  title?: string
  color: 'neon' | 'purple' | 'dim'
}> = ({ children, onClick, title, color }) => {
  const [hovered, setHovered] = React.useState(false)
  const raw =
    color === 'purple'
      ? 'var(--vrcd-purple-raw)'
      : color === 'neon'
        ? 'var(--vrcd-neon-raw)'
        : 'var(--vrcd-neon-raw)'
  const fg =
    color === 'purple'
      ? 'var(--vrcd-purple)'
      : color === 'neon'
        ? 'var(--vrcd-neon)'
        : 'rgba(var(--vrcd-neon-raw),0.7)'
  const dimMode = color === 'dim'
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && !dimMode ? `rgba(${raw},0.12)` : 'transparent',
        border: `${dimMode ? 1 : 2}px solid ${dimMode ? `rgba(${raw},0.3)` : `rgba(${raw},0.7)`}`,
        color: fg,
        fontFamily: 'var(--vrcd-font-mono)',
        fontSize: '13px',
        letterSpacing: '0.1em',
        padding: '12px 0',
        borderRadius: '6px',
        cursor: 'pointer',
        textTransform: 'uppercase',
        boxShadow:
          hovered && !dimMode ? `0 0 12px rgba(${raw},0.25)` : 'none',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s'
      }}
    >
      {children}
    </button>
  )
}
