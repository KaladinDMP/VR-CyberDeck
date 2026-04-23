import React, { useState, useEffect, useCallback, useRef } from 'react'
import { GameInfo } from '@shared/types'
import {
  Dialog,
  DialogSurface,
  DialogBody,
  Button,
  Spinner,
  ProgressBar,
  Text
} from '@fluentui/react-components'
import {
  ArrowClockwiseRegular,
  DismissRegular,
  DocumentDataRegular,
  CalendarClockRegular,
  ArrowDownloadRegular as DownloadIcon,
  TagRegular,
  DeleteRegular,
  ArrowSyncRegular,
  ArrowUpRegular,
  InfoRegular,
  CheckmarkCircleRegular,
  OpenRegular,
  BroomRegular as UninstallIcon
} from '@fluentui/react-icons'
import placeholderImage from '../assets/images/game-placeholder.png'
import { useGames } from '@renderer/hooks/useGames'

const NEON = '#39ff14'
const PURPLE = '#a855f7'
const BG = '#030310'
const SURFACE_VARS = {
  '--colorNeutralBackground1': BG,
  '--colorNeutralBackground2': '#050520',
  '--colorNeutralBackground3': '#040418',
  '--colorNeutralForeground1': NEON,
  '--colorNeutralForeground2': 'rgba(57,255,20,0.75)',
  '--colorNeutralForeground3': 'rgba(57,255,20,0.5)',
  '--colorNeutralStroke1': 'rgba(57,255,20,0.2)',
  '--colorBrandBackground': NEON,
  '--colorNeutralForegroundOnBrand': BG,
  '--colorPaletteRedForeground1': '#ff5555',
  '--colorPaletteRedBackground2': 'rgba(255,50,50,0.12)',
} as React.CSSProperties

interface GameDetailsDialogProps {
  game: GameInfo | null
  open: boolean
  onClose: () => void
  downloadStatusMap: Map<string, { status: string; progress: number }>
  onInstall: (game: GameInfo) => void
  onUninstall: (game: GameInfo) => Promise<void>
  onReinstall: (game: GameInfo) => Promise<void>
  onUpdate: (game: GameInfo) => Promise<void>
  onRetry: (game: GameInfo) => void
  onCancelDownload: (game: GameInfo) => void
  onDeleteDownloaded: (game: GameInfo) => void
  onInstallFromCompleted: (game: GameInfo) => void
  getNote: (releaseName: string) => Promise<string | null>
  isConnected: boolean
  isBusy: boolean
}

const GameDetailsDialog: React.FC<GameDetailsDialogProps> = ({
  game, open, onClose, downloadStatusMap,
  onInstall, onUninstall, onReinstall, onUpdate,
  onRetry, onCancelDownload, onDeleteDownloaded,
  onInstallFromCompleted, getNote, isConnected, isBusy
}) => {
  const { getTrailerVideoId: getTrailerVideoIdFromContext } = useGames()
  const [currentGameNote, setCurrentGameNote] = useState<string | null>(null)
  const [loadingNote, setLoadingNote] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [trailerOpen, setTrailerOpen] = useState(false)
  const webviewRef = useRef<HTMLElement>(null)

  const handleWebviewReady = useCallback(() => {
    const wv = webviewRef.current as HTMLElement & {
      insertCSS: (css: string) => Promise<string>
      executeJavaScript: (code: string) => Promise<unknown>
    }
    if (!wv) return
    wv.insertCSS(`
      #masthead-container, #top-row, #bottom-row, ytd-watch-metadata, #related,
      #comments, #secondary, #below, ytd-masthead, #guide-button,
      ytd-mini-guide-renderer, #chat-container, .ytp-chrome-top,
      #info-contents, #meta-contents, ytd-merch-shelf-renderer,
      tp-yt-app-drawer, #guide-wrapper, .ytd-watch-flexy #menu,
      #subscribe-button, .ytd-watch-flexy #actions,
      ytd-watch-next-secondary-results-renderer, #description, #header,
      ytd-engagement-panel-section-list-renderer, #panels,
      ytd-compact-video-renderer, .ytp-endscreen-content,
      .ytp-ce-element, .ytp-pause-overlay { display: none !important; }
      body { overflow: hidden !important; background: #000 !important; }
      #page-manager, ytd-watch-flexy, #player-container-outer,
      #player-container-inner, #player, #ytd-player,
      .html5-video-player, video {
        position: fixed !important; top: 0 !important; left: 0 !important;
        width: 100vw !important; height: 100vh !important;
        max-width: 100vw !important; max-height: 100vh !important;
        margin: 0 !important; padding: 0 !important;
      }
    `)
    wv.executeJavaScript(`const v=document.querySelector('video');if(v&&v.paused)v.play()`)
  }, [])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv || !videoId) return
    wv.addEventListener('dom-ready', handleWebviewReady)
    return () => wv.removeEventListener('dom-ready', handleWebviewReady)
  }, [videoId, handleWebviewReady])

  useEffect(() => {
    let alive = true
    if (open && game?.releaseName) {
      setLoadingNote(true)
      setCurrentGameNote(null)
      getNote(game.releaseName)
        .then((n) => { if (alive) setCurrentGameNote(n) })
        .catch(() => { if (alive) setCurrentGameNote('Error loading note.') })
        .finally(() => { if (alive) setLoadingNote(false) })
    }
    return () => { alive = false }
  }, [open, game, getNote])

  useEffect(() => {
    let alive = true
    if (open && game?.name) {
      setLoadingVideo(true)
      setVideoId(null)
      setTrailerOpen(false)
      getTrailerVideoIdFromContext(game.name)
        .then((id) => { if (alive && id) setVideoId(id) })
        .catch(() => { /* no trailer */ })
        .finally(() => { if (alive) setLoadingVideo(false) })
    }
    return () => { alive = false }
  }, [open, game, getTrailerVideoIdFromContext])

  const renderActionButtons = (g: GameInfo): React.ReactNode => {
    const status = downloadStatusMap.get(g.releaseName || '')?.status
    const canCancel = status === 'Downloading' || status === 'Extracting' || status === 'Queued'
    const isDownloaded = status === 'Completed'
    const isInstallError = status === 'InstallError'
    const isErrorOrCancelled = status === 'Error' || status === 'Cancelled'
    const isInstalling = status === 'Installing'

    if (isInstalling) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spinner size="small" /><Text>Installing...</Text>
      </div>
    )
    if (canCancel) return (
      <Button appearance="danger" icon={<DismissRegular />} onClick={() => onCancelDownload(g)} disabled={isBusy}>
        Cancel Download
      </Button>
    )
    if (isInstallError || isErrorOrCancelled) return (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={() => onRetry(g)} disabled={isBusy}>Retry</Button>
        <Button appearance="danger" icon={<DeleteRegular />} onClick={() => onDeleteDownloaded(g)} disabled={isBusy}>Delete Files</Button>
      </div>
    )
    if (g.isInstalled) {
      if (g.hasUpdate) return (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button appearance="primary" icon={<ArrowUpRegular />} onClick={() => onUpdate(g)} disabled={!isConnected || isBusy}>Update</Button>
          <Button appearance="danger" icon={<UninstallIcon />} onClick={() => onUninstall(g)} disabled={!isConnected || isBusy}>Uninstall</Button>
        </div>
      )
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button appearance="secondary" icon={<ArrowSyncRegular />} onClick={() => onReinstall(g)} disabled={!isConnected || isBusy}>Reinstall</Button>
          <Button appearance="danger" icon={<UninstallIcon />} onClick={() => onUninstall(g)} disabled={!isConnected || isBusy}>Uninstall</Button>
        </div>
      )
    }
    if (isDownloaded) return (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button appearance="primary" icon={<CheckmarkCircleRegular />} onClick={() => onInstallFromCompleted(g)} disabled={!isConnected || isBusy}>Install</Button>
        <Button appearance="danger" icon={<DeleteRegular />} onClick={() => onDeleteDownloaded(g)} disabled={isBusy}>Delete Files</Button>
      </div>
    )
    return (
      <Button appearance="primary" icon={<DownloadIcon />} onClick={() => onInstall(g)} disabled={isBusy}>
        {isConnected ? 'Install' : 'Download'}
      </Button>
    )
  }

  if (!game) return null

  const statusEntry = game.releaseName ? downloadStatusMap.get(game.releaseName) : undefined
  const dlStatus = statusEntry?.status
  const dlProgress = statusEntry?.progress ?? 0
  const showProgress = dlStatus === 'Downloading' || dlStatus === 'Extracting' || dlStatus === 'Installing'

  const statusColor = game.isInstalled ? NEON
    : dlStatus === 'Completed' ? 'rgba(57,255,20,0.5)'
    : dlStatus === 'InstallError' ? '#ff5555'
    : 'rgba(57,255,20,0.4)'
  const statusLabel = game.isInstalled ? (game.hasUpdate ? 'Update Available' : 'Installed')
    : dlStatus === 'Completed' ? 'Downloaded'
    : dlStatus === 'InstallError' ? 'Install Error'
    : dlStatus === 'Installing' ? 'Installing...'
    : 'Not Installed'

  return (
    <Dialog open={open} onOpenChange={(_e, d) => !d.open && onClose()} modalType="modal">
      <DialogSurface
        mountNode={document.getElementById('portal')}
        style={{
          ...SURFACE_VARS,
          background: BG,
          border: `1px solid rgba(57,255,20,0.4)`,
          boxShadow: `0 0 50px rgba(57,255,20,0.08), 0 0 1px rgba(168,85,247,0.3)`,
          maxWidth: '680px',
          width: '90vw',
          maxHeight: '92vh',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 10, right: 12, zIndex: 10,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(57,255,20,0.6)', fontSize: 18, lineHeight: 1,
            padding: '2px 6px'
          }}
          aria-label="Close"
        >✕</button>

        <DialogBody style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Cover + info row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16, alignItems: 'start' }}>
            {/* Cover image */}
            <img
              src={game.thumbnailPath ? `file://${game.thumbnailPath}` : placeholderImage}
              alt={game.name}
              style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(57,255,20,0.3)', display: 'block' }}
            />

            {/* Game meta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: NEON, fontFamily: 'monospace', letterSpacing: '0.04em', lineHeight: 1.2 }}>{game.name}</div>
              <div style={{ fontSize: 11, color: `${PURPLE}cc`, fontFamily: 'monospace' }}>{game.packageName}</div>

              {/* Status badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: statusColor, border: `1px solid ${statusColor}`, borderRadius: 4, padding: '1px 7px', letterSpacing: '0.06em' }}>
                  {statusLabel}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(57,255,20,0.6)', fontFamily: 'monospace' }}>
                  <DocumentDataRegular fontSize={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />{game.size || '-'}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(57,255,20,0.6)', fontFamily: 'monospace' }}>
                  <DownloadIcon fontSize={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />{game.downloads?.toLocaleString() || '-'}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(57,255,20,0.6)', fontFamily: 'monospace' }}>
                  <InfoRegular fontSize={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  {game.version ? `v${game.version}` : '-'}
                  {game.isInstalled && game.deviceVersionCode && <span style={{ color: 'rgba(57,255,20,0.4)' }}> (dev: v{game.deviceVersionCode})</span>}
                </span>
              </div>

              <div style={{ height: '1px', background: 'rgba(57,255,20,0.15)', marginTop: 4 }} />

              <div style={{ fontSize: 11, color: 'rgba(57,255,20,0.7)', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span><TagRegular fontSize={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{game.releaseName || '-'}</span>
                <span><CalendarClockRegular fontSize={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{String(game.lastUpdated || '-')}</span>
              </div>

              {/* ── ACTION BUTTONS (moved up) ── */}
              <div style={{ marginTop: 8 }}>
                {renderActionButtons(game)}
              </div>
            </div>
          </div>

          {/* Download progress */}
          {showProgress && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spinner size="tiny" />
                <span style={{ color: NEON, fontFamily: 'monospace', fontSize: 12 }}>{dlStatus}... {dlProgress}%</span>
              </div>
              <ProgressBar value={dlProgress} max={100} shape="rounded" thickness="medium" />
            </div>
          )}

          {/* ── Collapsible Trailer ── */}
          <div style={{ borderTop: '1px solid rgba(57,255,20,0.12)', paddingTop: 12 }}>
            <button
              onClick={() => setTrailerOpen(!trailerOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'rgba(57,255,20,0.8)', fontFamily: 'monospace', fontSize: 12,
                letterSpacing: '0.1em', textAlign: 'left', padding: '2px 0'
              }}
            >
              <span style={{ fontSize: 10 }}>{trailerOpen ? '▼' : '▶'}</span>
              <span>TRAILER</span>
              {loadingVideo && <Spinner size="tiny" style={{ marginLeft: 4 }} />}
              {videoId && !loadingVideo && (
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginLeft: 'auto', fontSize: 11, color: PURPLE, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <OpenRegular fontSize={11} /> Watch on YouTube
                </a>
              )}
              {!videoId && !loadingVideo && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(57,255,20,0.35)' }}>no trailer found</span>
              )}
            </button>

            {trailerOpen && videoId && (
              <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', marginTop: 10, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(57,255,20,0.2)' }}>
                <webview
                  ref={webviewRef}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' } as React.CSSProperties}
                  src={`https://www.youtube.com/watch?v=${videoId}`}
                  partition="persist:youtube"
                  allowpopups="true"
                  title="Game Trailer"
                />
              </div>
            )}
            {trailerOpen && !videoId && !loadingVideo && (
              <p style={{ color: 'rgba(57,255,20,0.4)', fontFamily: 'monospace', fontSize: 12, margin: '8px 0 0' }}>No trailer available.</p>
            )}
          </div>

          {/* ── Note section (bottom) ── */}
          <div style={{ borderTop: '1px solid rgba(57,255,20,0.12)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', color: 'rgba(57,255,20,0.6)', marginBottom: 6 }}>// NOTE</div>
            {loadingNote ? (
              <Spinner size="tiny" label="Loading..." />
            ) : currentGameNote ? (
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(57,255,20,0.8)', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto', background: 'rgba(57,255,20,0.03)', border: '1px solid rgba(57,255,20,0.12)', borderRadius: 4, padding: '8px 10px' }}>
                {currentGameNote}
              </div>
            ) : (
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(57,255,20,0.35)' }}>No note available.</span>
            )}
          </div>

        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

export default GameDetailsDialog
