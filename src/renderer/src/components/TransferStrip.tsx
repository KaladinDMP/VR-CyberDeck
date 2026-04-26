import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDownload } from '../hooks/useDownload'
import { useUpload } from '@renderer/hooks/useUpload'
import { DownloadItem, UploadItem } from '@shared/types'

type Entry = {
  key: string
  direction: 'down' | 'up'
  name: string
  stage: string
  progress: number | null
  speed?: string
  eta?: string
}

const downloadStageLabel = (status: DownloadItem['status']): string => {
  switch (status) {
    case 'Queued':
      return 'QUEUED'
    case 'Downloading':
      return 'DOWNLOADING'
    case 'Extracting':
      return 'EXTRACTING'
    case 'Installing':
      return 'INSTALLING'
    case 'Paused':
      return 'PAUSED'
    default:
      return String(status).toUpperCase()
  }
}

const uploadStageLabel = (item: UploadItem): string => {
  if (item.stage) return item.stage.toUpperCase()
  return String(item.status).toUpperCase()
}

const TransferStrip: React.FC = () => {
  const { queue: downloadQueue } = useDownload()
  const { queue: uploadQueue } = useUpload()

  const entries = useMemo<Entry[]>(() => {
    const downloads: Entry[] = downloadQueue
      .filter((d) =>
        ['Queued', 'Downloading', 'Extracting', 'Installing'].includes(d.status)
      )
      .map((d) => ({
        key: `d:${d.releaseName}`,
        direction: 'down',
        name: d.gameName,
        stage: downloadStageLabel(d.status),
        progress:
          d.status === 'Extracting' && typeof d.extractProgress === 'number'
            ? d.extractProgress
            : typeof d.progress === 'number'
              ? d.progress
              : null,
        speed: d.status === 'Downloading' ? d.speed : undefined,
        eta: d.status === 'Downloading' ? d.eta : undefined
      }))
    const uploads: Entry[] = uploadQueue
      .filter((u) => ['Queued', 'Preparing', 'Uploading'].includes(u.status))
      .map((u) => ({
        key: `u:${u.packageName}`,
        direction: 'up',
        name: u.gameName,
        stage: uploadStageLabel(u),
        progress: typeof u.progress === 'number' ? u.progress : null
      }))
    return [...downloads, ...uploads]
  }, [downloadQueue, uploadQueue])

  // Rotate through entries when there are more than one, so the user always
  // sees something even when many transfers are running.
  const [index, setIndex] = useState(0)
  const indexRef = useRef(index)
  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    if (entries.length <= 1) {
      if (index !== 0) setIndex(0)
      return
    }
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % entries.length)
    }, 4000)
    return () => clearInterval(id)
  }, [entries.length, index])

  if (entries.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          color: 'rgba(var(--vrcd-neon-raw),0.35)'
        }}
      >
        <span style={{ color: 'rgba(var(--vrcd-neon-raw),0.45)', letterSpacing: '0.14em' }}>
          // TRANSFER_BUS
        </span>
        <span style={{ color: 'rgba(var(--vrcd-neon-raw),0.3)' }}>IDLE — no active transfers</span>
      </div>
    )
  }

  const safeIndex = Math.min(index, entries.length - 1)
  const e = entries[safeIndex]
  const directionGlyph = e.direction === 'down' ? '↓' : '↑'
  const directionColor =
    e.direction === 'down' ? 'var(--vrcd-neon)' : 'var(--vrcd-purple)'
  const progressPct = e.progress != null ? Math.max(0, Math.min(100, e.progress)) : null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
        minWidth: 0
      }}
    >
      <span style={{ color: 'rgba(var(--vrcd-neon-raw),0.45)', letterSpacing: '0.14em', flexShrink: 0 }}>
        // TRANSFER_BUS
      </span>
      <span
        style={{
          color: directionColor,
          fontWeight: 700,
          fontSize: '14px',
          textShadow: `0 0 6px ${directionColor}`,
          flexShrink: 0
        }}
      >
        {directionGlyph}
      </span>
      <span
        style={{
          color: 'var(--vrcd-neon)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flexShrink: 1,
          minWidth: 0,
          maxWidth: '40%'
        }}
        title={e.name}
      >
        {e.name}
      </span>
      <span
        style={{
          color: 'rgba(var(--vrcd-purple-raw),0.9)' as unknown as string,
          letterSpacing: '0.08em',
          flexShrink: 0
        }}
      >
        {e.stage}
      </span>
      {progressPct !== null && (
        <>
          <div
            style={{
              flex: 1,
              minWidth: '60px',
              height: '6px',
              borderRadius: '3px',
              background: 'rgba(var(--vrcd-neon-raw),0.08)',
              border: '1px solid rgba(var(--vrcd-neon-raw),0.2)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: directionColor,
                boxShadow: `0 0 8px ${directionColor}`,
                transition: 'width 0.3s linear'
              }}
            />
          </div>
          <span style={{ color: 'var(--vrcd-neon)', flexShrink: 0, minWidth: '40px', textAlign: 'right' }}>
            {progressPct.toFixed(0)}%
          </span>
        </>
      )}
      {e.speed && (
        <span style={{ color: 'rgba(var(--vrcd-neon-raw),0.75)', flexShrink: 0 }}>{e.speed}</span>
      )}
      {e.eta && (
        <span style={{ color: 'rgba(var(--vrcd-neon-raw),0.5)', flexShrink: 0 }}>ETA {e.eta}</span>
      )}
      {entries.length > 1 && (
        <span
          style={{
            color: 'rgba(var(--vrcd-neon-raw),0.4)',
            flexShrink: 0,
            marginLeft: 'auto'
          }}
        >
          [{safeIndex + 1}/{entries.length}]
        </span>
      )}
    </div>
  )
}

export default TransferStrip
