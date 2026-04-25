import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAdb } from '../hooks/useAdb'
import { ExtendedDeviceInfo, hasBookmarkData, isWiFiBookmark } from '@shared/types'
import { AdbShellDialog } from './AdbShellDialog'
import { shouldShowBreach } from '../hooks/useExtrasSettings'
import '../assets/device-list-breach.css'

interface DeviceListProps {
  onSkip?: () => void
  onConnected?: () => void
}

// ─── Radar SVG background ─────────────────────────────────────────────────────
const RadarBg: React.FC<{ scanning: boolean }> = ({ scanning }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', overflow: 'hidden' }}>
    <svg width="520" height="520" viewBox="0 0 520 520" style={{ opacity: 0.18 }}>
      <circle cx="260" cy="260" r="240" fill="none" stroke="#39ff14" strokeWidth="1" className="breach-radar-ring" />
      <circle cx="260" cy="260" r="180" fill="none" stroke="#39ff14" strokeWidth="0.8" className="breach-radar-ring-2" />
      <circle cx="260" cy="260" r="120" fill="none" stroke="#39ff14" strokeWidth="0.6" className="breach-radar-ring" style={{ animationDelay: '0.8s' }} />
      <circle cx="260" cy="260" r="60" fill="none" stroke="#39ff14" strokeWidth="0.5" className="breach-radar-ring-2" style={{ animationDelay: '1.2s' }} />
      {/* Crosshairs */}
      <line x1="260" y1="0" x2="260" y2="520" stroke="#39ff14" strokeWidth="0.4" />
      <line x1="0" y1="260" x2="520" y2="260" stroke="#39ff14" strokeWidth="0.4" />
      {/* Diagonal cross */}
      <line x1="80" y1="80" x2="440" y2="440" stroke="#39ff14" strokeWidth="0.2" />
      <line x1="440" y1="80" x2="80" y2="440" stroke="#39ff14" strokeWidth="0.2" />
      {/* Radar sweep — only when actively scanning */}
      {scanning && (
        <g className="breach-radar-sweep">
          <defs>
            <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#39ff14" stopOpacity="0" />
              <stop offset="100%" stopColor="#39ff14" stopOpacity="0.5" />
            </radialGradient>
          </defs>
          <path d="M260,260 L260,20 A240,240 0 0,1 456,130 Z" fill="url(#sweepGrad)" />
        </g>
      )}
    </svg>
    {/* Scanlines */}
    <div className="breach-scanlines" style={{ position: 'absolute', inset: 0 }} />
  </div>
)

// ─── Breach sequence steps ────────────────────────────────────────────────────
const BREACH_STEPS = [
  { id: 'locate',    text: '> locating target device...',     ms: 320 },
  { id: 'port',      text: '> opening port 5555...',          ms: 380 },
  { id: 'handshake', text: '> negotiating handshake...',      ms: 520 },
  { id: 'auth',      text: '> bypassing auth layer...',       ms: 450 },
  { id: 'inject',    text: '> injecting ADB payload...',      ms: 380 },
  { id: 'shell',     text: '> shell access granted.',         ms: 0   }
]

type StepState = 'pending' | 'active' | 'done' | 'error'

interface BreachStep {
  id: string
  text: string
  state: StepState
}

const BreachSequence: React.FC<{
  deviceName: string
  onComplete: () => void
  onError: () => void
  error: boolean
}> = ({ deviceName, onComplete, onError, error }) => {
  const [steps, setSteps] = useState<BreachStep[]>(
    BREACH_STEPS.map((s) => ({ id: s.id, text: s.text, state: 'pending' as StepState }))
  )
  const [done, setDone] = useState(false)
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    let delay = 0
    BREACH_STEPS.forEach((step, i) => {
      const startAt = delay
      const isLast = i === BREACH_STEPS.length - 1

      // Mark step as active
      setTimeout(() => {
        if (cancelRef.current) return
        setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, state: 'active' } : s))
      }, startAt)

      // Mark step as done
      setTimeout(() => {
        if (cancelRef.current) return
        setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, state: 'done' } : s))
        if (isLast) {
          setDone(true)
          setTimeout(() => { if (!cancelRef.current) onComplete() }, 600)
        }
      }, startAt + step.ms + 120)

      delay += step.ms + 120
    })

    return () => { cancelRef.current = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (error) {
      cancelRef.current = true
      setSteps((prev) => prev.map((s) => s.state === 'active' ? { ...s, state: 'error' } : s))
    }
  }, [error])

  const S = { fontFamily: '"Courier New", monospace', fontSize: '13px', letterSpacing: '0.04em' }

  return (
    <div style={{ padding: '20px 24px', minHeight: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ ...S, color: 'rgba(57,255,20,0.5)', fontSize: '10px', letterSpacing: '0.16em', marginBottom: '8px' }}>
        TARGET: <span style={{ color: '#39ff14' }}>{deviceName}</span>
      </div>
      {steps.map((step, i) => {
        const color = step.state === 'done' ? '#39ff14'
          : step.state === 'active' ? 'rgba(57,255,20,0.7)'
          : step.state === 'error' ? '#ff4444'
          : 'rgba(57,255,20,0.25)'
        const glow = step.state === 'done' ? '0 0 8px rgba(57,255,20,0.6)'
          : step.state === 'error' ? '0 0 8px rgba(255,68,68,0.6)'
          : 'none'
        const prefix = step.state === 'done' ? '✓' : step.state === 'error' ? '✗' : step.state === 'active' ? '▶' : '·'
        return (
          <div key={step.id} className="breach-step" style={{ ...S, color, textShadow: glow, animationDelay: `${i * 0.05}s`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', flexShrink: 0, fontSize: '10px' }}>{prefix}</span>
            <span>{step.text}</span>
            {step.state === 'active' && <span className="breach-step-cursor" style={{ color: '#39ff14' }}>█</span>}
          </div>
        )
      })}
      {error && (
        <div style={{ ...S, color: '#ff4444', marginTop: '8px', textShadow: '0 0 8px rgba(255,68,68,0.5)' }}>
          ✗ CONNECTION FAILED — retrying...
          <button className="breach-btn" style={{ marginLeft: '12px', fontSize: '10px', padding: '3px 10px' }} onClick={onError}>ABORT</button>
        </div>
      )}
      {done && !error && (
        <div style={{ ...S, color: '#39ff14', marginTop: '8px', fontWeight: 'bold', textShadow: '0 0 12px rgba(57,255,20,0.9), 0 0 24px rgba(57,255,20,0.5)', letterSpacing: '0.12em' }}>
          ■■■ SHELL ACCESS GRANTED ■■■
        </div>
      )}
    </div>
  )
}

// ─── Signal bar widget ────────────────────────────────────────────────────────
const SignalBars: React.FC<{ ms?: number | null }> = ({ ms }) => {
  const strength = ms == null ? 0 : ms < 20 ? 5 : ms < 50 ? 4 : ms < 100 ? 3 : ms < 200 ? 2 : 1
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
      {[1,2,3,4,5].map((bar) => (
        <span key={bar} style={{
          width: '3px',
          height: `${bar * 2 + 4}px`,
          background: bar <= strength ? '#39ff14' : 'rgba(57,255,20,0.15)',
          boxShadow: bar <= strength ? '0 0 4px rgba(57,255,20,0.7)' : 'none',
          borderRadius: '1px',
          display: 'inline-block'
        }} />
      ))}
      {ms != null && (
        <span style={{ color: 'rgba(57,255,20,0.55)', fontSize: '10px', fontFamily: 'monospace', marginLeft: '4px', lineHeight: 1, alignSelf: 'center' }}>{ms}ms</span>
      )}
    </span>
  )
}

// ─── Device target card ───────────────────────────────────────────────────────
interface TargetCardProps {
  device: ExtendedDeviceInfo
  isConnected: boolean
  isConnecting: boolean
  connectionError: boolean
  onConnect: () => void
  onDisconnect: () => void
  onBookmark: () => void
  onDeleteBookmark: () => void
  onOpenShell: () => void
  isAlreadyBookmarked: boolean
}

const TargetCard: React.FC<TargetCardProps> = ({
  device, isConnected, isConnecting, connectionError,
  onConnect, onDisconnect, onBookmark, onDeleteBookmark, onOpenShell,
  isAlreadyBookmarked
}) => {
  const isWifiBook = isWiFiBookmark(device)
  const hasBook = hasBookmarkData(device)
  const isTcp = device.id.includes(':')
  const isConnectable = device.type === 'device' || device.type === 'emulator'
  const isOffline = device.type === 'offline'
  const isUnauth = device.type === 'unauthorized'
  const isWifi = isWifiBook || (hasBook && isTcp && isConnectable)
  const name = device.friendlyModelName || (device as any).model || device.id
  const statusBadgeColor = isConnected ? '#39ff14' : connectionError ? '#ff4444' : isConnecting ? '#a855f7' : isOffline ? '#666' : 'rgba(57,255,20,0.4)'
  const statusText = isConnected ? 'LINKED' : connectionError ? 'FAILED' : isConnecting ? 'BREACHING...' : isUnauth ? 'UNAUTHORIZED' : isOffline ? 'OFFLINE' : isWifiBook ? 'STANDBY' : 'DETECTED'

  const S = { fontFamily: '"Courier New", monospace' }

  return (
    <div className={isConnected ? 'breach-target-card' : ''} style={{
      background: isConnected
        ? 'linear-gradient(135deg, rgba(57,255,20,0.06) 0%, rgba(168,85,247,0.04) 100%)'
        : connectionError
        ? 'rgba(255,68,68,0.04)'
        : 'rgba(57,255,20,0.025)',
      border: `1px solid ${isConnected ? 'rgba(57,255,20,0.5)' : connectionError ? 'rgba(255,68,68,0.4)' : isWifi ? 'rgba(168,85,247,0.35)' : 'rgba(57,255,20,0.2)'}`,
      borderRadius: '6px',
      padding: '12px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '8px',
      transition: 'border-color 0.2s, background 0.2s',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Connecting shimmer */}
      {isConnecting && (
        <div style={{
          position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.08) 50%, transparent 100%)',
          animation: 'radarSweep 1.5s linear infinite',
          pointerEvents: 'none'
        }} />
      )}

      {/* Left: icon + info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
        {/* Icon block */}
        <div style={{ fontSize: '24px', flexShrink: 0, lineHeight: 1, paddingTop: '2px' }}>
          {isWifi ? '📡' : '🥽'}
        </div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ ...S, color: '#39ff14', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.06em', textShadow: isConnected ? '0 0 8px rgba(57,255,20,0.6)' : 'none' }}>
              {name.toUpperCase()}
            </span>
            {/* Status badge */}
            <span style={{
              ...S, fontSize: '9px', letterSpacing: '0.14em', padding: '2px 7px',
              border: `1px solid ${statusBadgeColor}`,
              color: statusBadgeColor,
              borderRadius: '3px',
              textShadow: isConnected ? `0 0 6px ${statusBadgeColor}` : 'none',
              boxShadow: isConnected ? `0 0 6px ${statusBadgeColor}40` : 'none',
              flexShrink: 0
            }}>
              {statusText}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            {/* Type label */}
            <span style={{ ...S, fontSize: '10px', color: isWifi ? 'rgba(168,85,247,0.7)' : 'rgba(57,255,20,0.45)', letterSpacing: '0.08em' }}>
              {isWifiBook ? '◈ WiFi Bookmark' : isWifi ? '◈ WiFi Device' : '◈ USB'}
              {!isConnectable && ` · ${device.type.toUpperCase()}`}
            </span>

            {/* IP */}
            {(device as any).ipAddress && (
              <span style={{ ...S, fontSize: '10px', color: 'rgba(57,255,20,0.5)', letterSpacing: '0.06em' }}>
                IP: {(device as any).ipAddress}
              </span>
            )}

            {/* Battery */}
            {(device as any).batteryLevel != null && (
              <span style={{ ...S, fontSize: '10px', color: 'rgba(57,255,20,0.5)' }}>
                ⚡ {(device as any).batteryLevel}%
              </span>
            )}

            {/* Storage */}
            {(device as any).storageFree && (
              <span style={{ ...S, fontSize: '10px', color: 'rgba(57,255,20,0.5)' }}>
                💾 {(device as any).storageFree} free
              </span>
            )}

            {/* Ping / signal */}
            {isWifi && (
              <span>
                {(device as any).pingStatus === 'reachable' && (
                  <SignalBars ms={(device as any).pingResponseTime ?? null} />
                )}
                {(device as any).pingStatus === 'unreachable' && (
                  <span style={{ ...S, fontSize: '10px', color: '#ff4444' }}>OFFLINE</span>
                )}
                {(device as any).pingStatus === 'checking' && (
                  <span style={{ ...S, fontSize: '10px', color: 'rgba(57,255,20,0.4)' }}>PINGING...</span>
                )}
              </span>
            )}

            {/* Non-Quest warning */}
            {isConnectable && !(device as any).isQuestDevice && !isWifi && (
              <span style={{ ...S, fontSize: '10px', color: '#f5a623' }}>⚠ UNKNOWN DEVICE</span>
            )}
          </div>

          {/* Connection error */}
          {connectionError && (
            <span style={{ ...S, fontSize: '10px', color: '#ff4444', textShadow: '0 0 6px rgba(255,68,68,0.5)' }}>
              ✗ Connection failed — check device
            </span>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
        {isConnected ? (
          <>
            <button className="breach-btn breach-btn-primary" onClick={onOpenShell}
              style={{ fontSize: '10px', padding: '5px 12px' }}>
              ⌨ SHELL
            </button>
            <button className="breach-btn breach-btn-purple" onClick={onDisconnect}
              style={{ fontSize: '10px', padding: '5px 12px' }}>
              ✗ SEVER LINK
            </button>
          </>
        ) : isConnecting ? (
          <button className="breach-btn" disabled style={{ fontSize: '10px', padding: '5px 14px', color: '#a855f7', borderColor: 'rgba(168,85,247,0.5)' }}>
            BREACHING...
          </button>
        ) : isWifiBook ? (
          <>
            <button className="breach-btn breach-btn-primary" onClick={onConnect}
              disabled={(device as any).pingStatus === 'unreachable'}
              style={{ fontSize: '10px', padding: '5px 12px' }}>
              ▶ BREACH
            </button>
            <button className="breach-btn breach-btn-purple" onClick={onDeleteBookmark}
              style={{ fontSize: '10px', padding: '5px 12px' }}>
              ✗ PURGE
            </button>
          </>
        ) : isConnectable ? (
          <>
            <button className="breach-btn breach-btn-primary" onClick={onConnect}
              style={{ fontSize: '10px', padding: '5px 12px' }}>
              ▶ BREACH
            </button>
            {(device as any).ipAddress && !isTcp && !isAlreadyBookmarked && (
              <button className="breach-btn" onClick={onBookmark}
                style={{ fontSize: '10px', padding: '4px 10px', borderColor: 'rgba(168,85,247,0.4)', color: '#a855f7' }}>
                ◈ SAVE TARGET
              </button>
            )}
            {isAlreadyBookmarked && (
              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(168,85,247,0.5)', letterSpacing: '0.1em' }}>SAVED</span>
            )}
          </>
        ) : (
          <button className="breach-btn" disabled style={{ fontSize: '10px', padding: '5px 12px' }}>
            INACCESSIBLE
          </button>
        )}
      </div>
    </div>
  )
}

// ─── TCP Add Form ──────────────────────────────────────────────────────────────
const AddTargetForm: React.FC<{
  onAdd: (ip: string, port: number) => Promise<void>
  disabled: boolean
}> = ({ onAdd, disabled }) => {
  const [ip, setIp] = useState('')
  const [port, setPort] = useState('5555')
  const [loading, setLoading] = useState(false)
  const S = { fontFamily: '"Courier New", monospace', fontSize: '11px' }

  const handleAdd = async (): Promise<void> => {
    if (!ip.trim()) return
    setLoading(true)
    try { await onAdd(ip.trim(), parseInt(port) || 5555) }
    finally { setLoading(false); setIp('') }
  }

  const isValidIp = /^[\d.]+$/.test(ip)
  const portColor = 'rgba(168,85,247,0.7)'

  return (
    <div style={{ padding: '12px 0 16px', borderBottom: '1px solid rgba(57,255,20,0.1)', marginBottom: '12px' }}>
      <div style={{ ...S, color: 'rgba(57,255,20,0.5)', letterSpacing: '0.12em', marginBottom: '8px', fontSize: '9px' }}>
        ◈ MANUAL TARGET ENTRY
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="breach-input"
          placeholder="TARGET IP (192.168.x.x)"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          style={{
            flex: '1 1 160px',
            minWidth: '120px',
            padding: '7px 10px',
            borderRadius: '4px',
            outline: 'none',
            background: 'rgba(57,255,20,0.04)',
            border: `1px solid ${ip && isValidIp ? 'rgba(57,255,20,0.6)' : ip ? 'rgba(255,68,68,0.5)' : 'rgba(57,255,20,0.3)'}`,
            color: ip && isValidIp ? '#39ff14' : ip ? '#ff6666' : 'rgba(57,255,20,0.6)',
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
            letterSpacing: '0.05em',
            boxShadow: ip && isValidIp ? '0 0 6px rgba(57,255,20,0.1)' : 'none'
          }}
        />
        <input
          className="breach-input"
          placeholder="PORT"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          style={{
            width: '72px',
            padding: '7px 10px',
            borderRadius: '4px',
            outline: 'none',
            background: 'rgba(168,85,247,0.03)',
            border: `1px solid rgba(168,85,247,0.35)`,
            color: portColor,
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
            letterSpacing: '0.05em'
          }}
        />
        <button
          className="breach-btn"
          onClick={handleAdd}
          disabled={!ip.trim() || loading || disabled}
          style={{ padding: '7px 14px' }}
        >
          {loading ? 'ADDING...' : '◈ SAVE TARGET'}
        </button>
      </div>
    </div>
  )
}

// ─── Main DeviceList component ─────────────────────────────────────────────────
const DeviceList: React.FC<DeviceListProps> = ({ onSkip, onConnected }) => {
  const {
    devices, selectedDevice, isConnected, isLoading, error,
    connectToDevice, connectTcpDevice, disconnectTcpDevice,
    refreshDevices, disconnectDevice
  } = useAdb()

  const [tcpIpAddress, setTcpIpAddress] = useState('')
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null)
  const [connectionErrorId, setConnectionErrorId] = useState<string | null>(null)
  const [shellDialogDeviceId, setShellDialogDeviceId] = useState<string | null>(null)
  const [breachTargetId, setBreachTargetId] = useState<string | null>(null)
  const [breachError, setBreachError] = useState(false)
  const breachEnabled = useRef(shouldShowBreach()).current

  // Auto-connect: when a Quest appears and nothing connected yet
  const hasAutoConnected = React.useRef(false)
  useEffect(() => {
    if (isConnected || isLoading || hasAutoConnected.current) return
    const q = devices.find((d) => (d as any).isQuestDevice && (d.type === 'device' || d.type === 'emulator'))
    if (!q) return
    hasAutoConnected.current = true
    handleConnect(q.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, isConnected, isLoading])

  const bookmarkedIps = React.useMemo(() =>
    devices
      .filter((d) => isWiFiBookmark(d) || hasBookmarkData(d))
      .map((d) => isWiFiBookmark(d) ? (d as any).ipAddress : hasBookmarkData(d) ? d.bookmarkData.ipAddress : null)
      .filter(Boolean) as string[],
  [devices])

  const handleConnect = useCallback(async (serial: string): Promise<void> => {
    setConnectingDeviceId(serial)
    setConnectionErrorId(null)
    setBreachError(false)

    if (breachEnabled) setBreachTargetId(serial)

    try {
      const success = await connectToDevice(serial)
      if (success) {
        setConnectionErrorId(null)
        if (!breachEnabled && onConnected) onConnected()
      } else {
        setBreachError(true)
        setConnectionErrorId(serial)
        setBreachTargetId(null)
      }
    } catch {
      setBreachError(true)
      setConnectionErrorId(serial)
      setBreachTargetId(null)
    } finally {
      setConnectingDeviceId(null)
    }
  }, [breachEnabled, connectToDevice, onConnected])

  const handleConnectBookmark = useCallback(async (device: ExtendedDeviceInfo): Promise<void> => {
    if (!hasBookmarkData(device)) return
    const { ipAddress, port, id } = device.bookmarkData
    setConnectingDeviceId(device.id)
    setConnectionErrorId(null)
    setBreachError(false)

    if (breachEnabled) setBreachTargetId(device.id)

    try {
      const success = await connectTcpDevice(ipAddress, port)
      if (success) {
        await window.api.wifiBookmarks.updateLastConnected(id)
        if (!breachEnabled && onConnected) onConnected()
      } else {
        setBreachError(true)
        setConnectionErrorId(device.id)
        setBreachTargetId(null)
      }
    } catch {
      setBreachError(true)
      setConnectionErrorId(device.id)
      setBreachTargetId(null)
    } finally {
      setConnectingDeviceId(null)
    }
  }, [breachEnabled, connectTcpDevice, onConnected])

  const handleBreachComplete = useCallback(() => {
    setBreachTargetId(null)
    if (onConnected) onConnected()
  }, [onConnected])

  const handleBreachAbort = useCallback(() => {
    setBreachTargetId(null)
    setBreachError(false)
    setConnectingDeviceId(null)
  }, [])

  const handleAddTcp = useCallback(async (ip: string, port: number): Promise<void> => {
    await window.api.wifiBookmarks.add(`${ip}:${port}`, ip, port)
    refreshDevices()
  }, [refreshDevices])

  const handleBookmark = useCallback(async (device: ExtendedDeviceInfo): Promise<void> => {
    const ip = (device as any).ipAddress
    if (!ip) return
    const name = device.friendlyModelName || (device as any).model || device.id
    await window.api.wifiBookmarks.add(`${name} (${ip})`, ip, 5555)
    refreshDevices()
  }, [refreshDevices])

  const handleDeleteBookmark = useCallback(async (device: ExtendedDeviceInfo): Promise<void> => {
    if (!hasBookmarkData(device)) return
    await window.api.wifiBookmarks.remove(device.bookmarkData.id)
    refreshDevices()
  }, [refreshDevices])

  const handleDisconnect = useCallback(async (device: ExtendedDeviceInfo): Promise<void> => {
    const isTcp = device.id.includes(':')
    if (isTcp) {
      const [ip, portStr] = device.id.split(':')
      await disconnectTcpDevice(ip, parseInt(portStr) || 5555)
    } else {
      disconnectDevice()
    }
  }, [disconnectDevice, disconnectTcpDevice])

  // ── rendering helpers ──
  const S = { fontFamily: '"Courier New", monospace' }

  // The device currently in a breach animation
  const breachDevice = breachTargetId ? devices.find((d) => d.id === breachTargetId) : null
  const breachDeviceName = breachDevice
    ? (breachDevice.friendlyModelName || (breachDevice as any).model || breachDevice.id).toUpperCase()
    : tcpIpAddress || '...'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100%', padding: '24px',
      background: '#050514',
      backgroundImage: 'linear-gradient(rgba(57,255,20,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,20,0.025) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Radar background */}
      <RadarBg scanning={isLoading || connectingDeviceId !== null} />

      {/* Main panel */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%', maxWidth: '640px',
        background: 'rgba(5,5,20,0.88)',
        border: '1px solid rgba(57,255,20,0.28)',
        borderRadius: '8px',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 0 40px rgba(57,255,20,0.06), 0 0 80px rgba(168,85,247,0.04)',
        overflow: 'hidden'
      }}>
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid rgba(57,255,20,0.15)',
          background: 'rgba(57,255,20,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ ...S, color: '#39ff14', fontSize: '13px', letterSpacing: '0.16em', fontWeight: 'bold',
              textShadow: '0 0 10px rgba(57,255,20,0.6)' }}>
              TARGET ACQUISITION
            </span>
            {isLoading && (
              <span style={{ ...S, fontSize: '10px', color: 'rgba(168,85,247,0.7)', letterSpacing: '0.12em',
                animation: 'cursorBlink 1s step-end infinite' }}>
                SCANNING...
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="breach-btn" onClick={() => refreshDevices()} disabled={isLoading}
              style={{ fontSize: '10px', padding: '5px 12px' }}>
              {isLoading ? '◉ SCANNING' : '↺ SCAN'}
            </button>
            {onSkip && !isConnected && (
              <button className="breach-btn breach-btn-purple" onClick={onSkip}
                style={{ fontSize: '10px', padding: '5px 12px' }}>
                ⟩ OFFLINE MODE
              </button>
            )}
            {onSkip && isConnected && (
              <button className="breach-btn breach-btn-primary" onClick={onSkip}
                style={{ fontSize: '10px', padding: '5px 12px' }}>
                ⟩ CONTINUE
              </button>
            )}
          </div>
        </div>

        {/* Breach sequence overlay */}
        {breachEnabled && breachTargetId && (
          <BreachSequence
            deviceName={breachDeviceName}
            onComplete={handleBreachComplete}
            onError={handleBreachAbort}
            error={breachError}
          />
        )}

        {/* Normal content (hidden during breach) */}
        {(!breachEnabled || !breachTargetId) && (
          <div style={{ padding: '16px 20px' }}>
            {/* Error banner */}
            {error && (
              <div style={{ ...S, fontSize: '12px', color: '#ff4444', padding: '10px 14px',
                background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.3)',
                borderRadius: '4px', marginBottom: '12px' }}>
                ✗ ERROR: {error}
              </div>
            )}

            {/* Add target form */}
            <AddTargetForm onAdd={handleAddTcp} disabled={isLoading} />

            {/* Device list area */}
            <div style={{ minHeight: '140px' }}>
              {!error && isLoading && devices.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ ...S, color: 'rgba(57,255,20,0.5)', fontSize: '12px', letterSpacing: '0.14em', marginBottom: '8px' }}>
                    SCANNING NETWORK...
                  </div>
                  <div style={{ ...S, color: 'rgba(57,255,20,0.25)', fontSize: '10px', letterSpacing: '0.1em' }}>
                    NO TARGETS FOUND
                  </div>
                </div>
              )}

              {!error && !isLoading && devices.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ ...S, color: 'rgba(57,255,20,0.35)', fontSize: '13px', letterSpacing: '0.1em', marginBottom: '6px' }}>
                    NO TARGETS DETECTED
                  </div>
                  <div style={{ ...S, color: 'rgba(57,255,20,0.2)', fontSize: '11px', lineHeight: 1.7 }}>
                    Connect device via USB or save a WiFi target above.<br />
                    Ensure ADB debugging is enabled on the headset.
                  </div>
                </div>
              )}

              {devices.map((device) => {
                const isCurrent = selectedDevice === device.id && isConnected
                const isConnecting = connectingDeviceId === device.id
                const hasError = connectionErrorId === device.id

                return (
                  <TargetCard
                    key={device.id}
                    device={device}
                    isConnected={isCurrent}
                    isConnecting={isConnecting}
                    connectionError={hasError}
                    onConnect={() => {
                      if (hasBookmarkData(device)) {
                        handleConnectBookmark(device)
                      } else {
                        handleConnect(device.id)
                      }
                    }}
                    onDisconnect={() => handleDisconnect(device)}
                    onBookmark={() => handleBookmark(device)}
                    onDeleteBookmark={() => handleDeleteBookmark(device)}
                    onOpenShell={() => setShellDialogDeviceId(device.id)}
                    isAlreadyBookmarked={!!(device as any).ipAddress && bookmarkedIps.includes((device as any).ipAddress)}
                  />
                )
              })}
            </div>

            {/* Footer: connected status */}
            {isConnected && (
              <div style={{
                marginTop: '12px', paddingTop: '12px',
                borderTop: '1px solid rgba(57,255,20,0.1)',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#39ff14',
                  boxShadow: '0 0 8px rgba(57,255,20,0.8)', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ ...S, fontSize: '11px', color: 'rgba(57,255,20,0.7)', letterSpacing: '0.08em' }}>
                  SECURE LINK ESTABLISHED
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADB Shell Dialog */}
      {shellDialogDeviceId && (
        <AdbShellDialog
          deviceId={shellDialogDeviceId}
          isOpen={true}
          onDismiss={() => setShellDialogDeviceId(null)}
        />
      )}
    </div>
  )
}

export default DeviceList
