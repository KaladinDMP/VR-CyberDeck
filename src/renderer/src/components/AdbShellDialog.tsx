import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogActions
} from '@fluentui/react-components'
import { getMatrixUsername, isFirstLaunchToday } from '../utils/matrixUsername'
import { shouldShowMatrixShell } from '../hooks/useExtrasSettings'
import AdbShortcuts from './AdbShortcuts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  command: string
  output: string | null
  error?: boolean
  /** rendered output (grows char-by-char via typing animation) */
  rendered?: string
  /** typing animation complete */
  typingDone?: boolean
}

interface AdbShellDialogProps {
  deviceId: string
  isOpen: boolean
  onDismiss: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NEON = 'var(--vrcd-neon)'
const NEON_DIM = 'rgba(var(--vrcd-neon-raw),0.35)'
const NEON_DIM2 = 'rgba(var(--vrcd-neon-raw),0.18)'
const BG_SURFACE = '#030310'
const BG_TERMINAL = '#000008'
const CHAR_POOL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF'

const PHASE_1_END = 1500  // ms — rain + "INITIALIZING..."
const PHASE_2_END = 2500  // ms — "FOLLOW THE WHITE RABBIT..."
// Phase 3 starts at 2500ms — terminal revealed
// USERNAME_PREFS_KEY exported from matrixUsername utility

// ─── Matrix Canvas Animation ─────────────────────────────────────────────────

interface Column {
  x: number
  y: number
  speed: number
  chars: string[]
  head: number
}

function useMatrixCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const fontSize = 14
    const colCount = Math.floor(W / fontSize)

    const columns: Column[] = Array.from({ length: colCount }, (_, i) => ({
      x: i * fontSize,
      y: Math.random() * -H,
      speed: 1 + Math.random() * 2,
      chars: Array.from({ length: 30 }, () => CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)]),
      head: 0
    }))

    let rafId = 0
    let running = true

    const draw = (): void => {
      if (!running) return

      // semi-transparent black overlay for trail effect
      ctx.fillStyle = 'rgba(0,0,8,0.18)'
      ctx.fillRect(0, 0, W, H)

      ctx.font = `${fontSize}px 'Courier New', monospace`

      for (const col of columns) {
        // bright head char
        ctx.fillStyle = '#ccffcc'
        ctx.shadowColor = NEON
        ctx.shadowBlur = 8
        ctx.fillText(col.chars[col.head % col.chars.length], col.x, col.y)

        // trailing chars
        for (let j = 1; j < 20; j++) {
          const alpha = 1 - j / 20
          ctx.fillStyle = `rgba(var(--vrcd-neon-raw),${alpha * 0.85})`
          ctx.shadowBlur = 4
          ctx.fillText(
            col.chars[(col.head - j + col.chars.length) % col.chars.length],
            col.x,
            col.y - j * fontSize
          )
        }

        col.y += col.speed * fontSize * 0.35
        col.head = (col.head + 1) % col.chars.length

        // randomise char occasionally
        if (Math.random() < 0.08) {
          const idx = Math.floor(Math.random() * col.chars.length)
          col.chars[idx] = CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)]
        }

        if (col.y > H + fontSize * 20) {
          col.y = Math.random() * -H * 0.5
          col.speed = 1 + Math.random() * 2
        }
      }

      ctx.shadowBlur = 0
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
    }
  }, [active, canvasRef])
}

// ─── Typing animation hook ────────────────────────────────────────────────────

const INSTANT_THRESHOLD = 200

function useTypingAnimation(
  history: HistoryEntry[],
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>
): void {
  // Watch for new entries that haven't been typed yet
  useEffect(() => {
    const lastIdx = history.length - 1
    if (lastIdx < 0) return
    const last = history[lastIdx]
    if (last.typingDone || last.rendered !== undefined) return
    if (last.output === null) {
      setHistory((prev) =>
        prev.map((e, i) => (i === lastIdx ? { ...e, rendered: '', typingDone: true } : e))
      )
      return
    }

    const full = last.output
    if (full.length > INSTANT_THRESHOLD) {
      // Show instantly
      setHistory((prev) =>
        prev.map((e, i) => (i === lastIdx ? { ...e, rendered: full, typingDone: true } : e))
      )
      return
    }

    // Type char by char
    let charIdx = 0
    let cancelled = false

    const step = (): void => {
      if (cancelled) return
      charIdx++
      const slice = full.slice(0, charIdx)
      setHistory((prev) =>
        prev.map((e, i) =>
          i === lastIdx
            ? { ...e, rendered: slice, typingDone: charIdx >= full.length }
            : e
        )
      )
      if (charIdx < full.length) {
        const delay = 8 + Math.random() * 4  // 8-12 ms
        setTimeout(step, delay)
      }
    }

    const delay = 8 + Math.random() * 4
    const t = setTimeout(step, delay)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length])
}

// ─── Styles (inline, no makeStyles needed) ───────────────────────────────────

const S = {
  surface: {
    background: BG_SURFACE,
    border: `1px solid rgba(var(--vrcd-neon-raw),0.4)`,
    minWidth: '760px',
    maxWidth: '1100px',
    padding: '0',
    boxShadow: '0 0 40px rgba(var(--vrcd-neon-raw),0.08), 0 0 80px rgba(var(--vrcd-neon-raw),0.04)',
    borderRadius: '6px',
    overflow: 'hidden'
  } as React.CSSProperties,

  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    padding: 0
  } as React.CSSProperties,

  titleBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px 10px',
    borderBottom: `1px solid ${NEON_DIM}`,
    background: 'rgba(0,0,16,0.8)'
  } as React.CSSProperties,

  titleText: {
    fontFamily: "'Courier New', monospace",
    fontSize: '13px',
    color: NEON,
    letterSpacing: '0.08em',
    textShadow: `0 0 10px ${NEON}`,
    userSelect: 'none' as const
  } as React.CSSProperties,

  content: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  } as React.CSSProperties,

  terminal: {
    background: BG_TERMINAL,
    border: `1px solid ${NEON_DIM}`,
    borderRadius: '4px',
    fontFamily: "'Courier New', monospace",
    fontSize: '13px',
    color: NEON,
    padding: '12px 14px',
    height: '360px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    cursor: 'text'
  } as React.CSSProperties,

  outputText: {
    color: NEON,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    textShadow: `0 0 6px rgba(var(--vrcd-neon-raw),0.5)`
  } as React.CSSProperties,

  errorText: {
    color: '#ff4444',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    textShadow: '0 0 6px rgba(255,60,60,0.5)'
  } as React.CSSProperties,

  emptyHint: {
    color: 'rgba(var(--vrcd-neon-raw),0.4)',
    fontStyle: 'italic' as const,
    fontFamily: "'Courier New', monospace"
  } as React.CSSProperties,

  prompt: {
    color: NEON,
    textShadow: `0 0 8px ${NEON}`,
    userSelect: 'none' as const,
    marginRight: '6px'
  } as React.CSSProperties,

  commandText: {
    color: '#a8ffb0',
    textShadow: '0 0 4px rgba(168,255,176,0.4)'
  } as React.CSSProperties,

  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: BG_TERMINAL,
    border: `1px solid ${NEON_DIM}`,
    borderRadius: '4px',
    padding: '6px 12px'
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    padding: '10px 20px 16px',
    borderTop: `1px solid ${NEON_DIM2}`
  } as React.CSSProperties,

  neonBtn: {
    background: 'transparent',
    border: `1px solid ${NEON_DIM}`,
    color: NEON,
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    padding: '5px 16px',
    borderRadius: '3px',
    transition: 'border-color 0.15s, box-shadow 0.15s, color 0.15s'
  } as React.CSSProperties,

  neonBtnHover: {
    borderColor: NEON,
    boxShadow: `0 0 8px rgba(var(--vrcd-neon-raw),0.4)`,
    color: '#ccffcc'
  } as React.CSSProperties
}

// ─── NeonButton ───────────────────────────────────────────────────────────────

function NeonButton({
  children,
  onClick,
  disabled
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}): React.ReactElement {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      style={{
        ...S.neonBtn,
        ...(hovered && !disabled ? S.neonBtnHover : {}),
        ...(disabled ? { opacity: 0.35, cursor: 'not-allowed' } : {})
      }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

// ─── MatrixIntro ──────────────────────────────────────────────────────────────

type AnimPhase = 'rain' | 'rabbit' | 'done'

interface MatrixIntroProps {
  onComplete: () => void
  width: number
  height: number
  holdMs: number
  username: string
}

function MatrixIntro({ onComplete, width, height, holdMs, username }: MatrixIntroProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [animPhase, setAnimPhase] = useState<AnimPhase>('rain')
  const [initOpacity, setInitOpacity] = useState(0)
  const [rainOpacity, setRainOpacity] = useState(1)
  const [cursorOn, setCursorOn] = useState(true)

  useMatrixCanvas(canvasRef, animPhase === 'rain' || animPhase === 'rabbit')

  // Fade in "INITIALIZING..." during phase 1
  useEffect(() => {
    const t = setTimeout(() => setInitOpacity(1), 300)
    return () => clearTimeout(t)
  }, [])

  // Transition to phase 2 at 1500ms
  useEffect(() => {
    const t = setTimeout(() => {
      setAnimPhase('rabbit')
      setRainOpacity(0)
    }, PHASE_1_END)
    return () => clearTimeout(t)
  }, [])

  // Cursor blink during phase 2
  useEffect(() => {
    if (animPhase !== 'rabbit') return
    const t = setInterval(() => setCursorOn((v) => !v), 500)
    return () => clearInterval(t)
  }, [animPhase])

  // Complete at holdMs
  useEffect(() => {
    const t = setTimeout(() => {
      setAnimPhase('done')
      onComplete()
    }, holdMs)
    return () => clearTimeout(t)
  }, [onComplete, holdMs])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        background: BG_TERMINAL,
        borderRadius: '4px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Canvas for falling chars */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: rainOpacity,
          transition: animPhase === 'rabbit' ? 'opacity 0.6s ease-out' : 'none',
          display: 'block'
        }}
      />

      {/* Phase 1 overlay text: INITIALIZING... */}
      {animPhase === 'rain' && (
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px',
            letterSpacing: '0.25em',
            color: 'rgba(var(--vrcd-neon-raw),0.7)',
            textShadow: `0 0 12px ${NEON}`,
            opacity: initOpacity,
            transition: 'opacity 0.8s ease-in',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            zIndex: 2
          }}
        >
          INITIALIZING...
        </div>
      )}

      {/* Phase 2: FOLLOW THE WHITE RABBIT */}
      {animPhase === 'rabbit' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: "'Courier New', monospace",
            userSelect: 'none',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div
            style={{
              fontSize: '20px',
              letterSpacing: '0.25em',
              color: NEON,
              textShadow: `0 0 16px ${NEON}, 0 0 32px rgba(var(--vrcd-neon-raw),0.5), 0 0 60px rgba(var(--vrcd-neon-raw),0.2)`,
              animation: 'matrixFadeIn 0.4s ease-out forwards, rabbitPulse 1.2s ease-in-out 0.4s infinite'
            }}
          >
            FOLLOW THE WHITE RABBIT
            <span
              style={{
                display: 'inline-block',
                marginLeft: '4px',
                opacity: cursorOn ? 1 : 0,
                color: NEON,
                textShadow: `0 0 12px ${NEON}`
              }}
            >
              _
            </span>
          </div>
          <div
            style={{
              fontSize: '13px',
              letterSpacing: '0.15em',
              color: 'rgba(var(--vrcd-neon-raw),0.55)',
              fontFamily: "'Courier New', monospace",
              animation: 'matrixFadeIn 0.6s ease-out 0.2s both'
            }}
          >
            {`> identity confirmed: `}<span style={{ color: NEON, textShadow: `0 0 8px ${NEON}` }}>{username}</span>
          </div>
        </div>
      )}

      {/* Keyframes injected via a style tag */}
      <style>{`
        @keyframes matrixFadeIn {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes rabbitPulse {
          0%, 100% { opacity: 1; text-shadow: 0 0 16px var(--vrcd-neon), 0 0 32px rgba(var(--vrcd-neon-raw),0.5), 0 0 60px rgba(var(--vrcd-neon-raw),0.2); }
          50%       { opacity: 0.65; text-shadow: 0 0 28px var(--vrcd-neon), 0 0 52px rgba(var(--vrcd-neon-raw),0.7), 0 0 90px rgba(var(--vrcd-neon-raw),0.35); }
        }
      `}</style>
    </div>
  )
}

// ─── FlashInput ───────────────────────────────────────────────────────────────
// Wraps a plain <input> and flashes the last typed character on each keystroke.

interface FlashInputProps {
  value: string
  onChange: (val: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  disabled?: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
}

function FlashInput({ value, onChange, onKeyDown, disabled, inputRef }: FlashInputProps): React.ReactElement {
  const [flash, setFlash] = useState(false)
  const [flashKey, setFlashKey] = useState(0)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onChange(e.target.value)
    // Trigger flash on character addition
    if (e.target.value.length > value.length) {
      setFlash(false)
      requestAnimationFrame(() => {
        setFlashKey((k) => k + 1)
        setFlash(true)
        setTimeout(() => setFlash(false), 150)
      })
    }
  }

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder="enter shell command..."
        spellCheck={false}
        autoComplete="off"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: "'Courier New', monospace",
          fontSize: '13px',
          color: NEON,
          caretColor: NEON,
          width: '100%',
          letterSpacing: '0.02em',
          opacity: disabled ? 0.45 : 1,
          // Flash: scale up slightly via filter brightness
          filter: flash ? 'brightness(1.6)' : 'brightness(1)',
          transform: flash ? 'scaleX(1.005)' : 'scaleX(1)',
          transition: flash ? 'none' : 'filter 0.12s ease-out, transform 0.12s ease-out'
        }}
        key={flashKey > 0 ? undefined : undefined}
      />
      {/* blinking cursor indicator overlay (shown when field active but value empty) */}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdbShellDialog({ deviceId, isOpen, onDismiss }: AdbShellDialogProps): React.ReactElement {
  const matrixUsername = useRef(getMatrixUsername()).current
  const firstLaunch = useRef(isFirstLaunchToday()).current
  const PHASE_2_HOLD = firstLaunch ? 4000 : 2500  // hold longer on first launch of day
  const matrixEnabled = useRef(shouldShowMatrixShell()).current

  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [animDone, setAnimDone] = useState(!matrixEnabled)
  const [dialogSize, setDialogSize] = useState({ w: 700, h: 440 })

  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Typing animation for output
  useTypingAnimation(history, setHistory)

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setHistory([])
      setCommand('')
      setHistoryIndex(-1)
      setAnimDone(!matrixEnabled)
    }
  }, [isOpen, matrixEnabled])

  // Measure container for canvas sizing
  useEffect(() => {
    if (!isOpen) return
    const measure = (): void => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0) {
          setDialogSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) })
        }
      }
    }
    // Delay to let dialog render
    const t = setTimeout(measure, 40)
    return () => clearTimeout(t)
  }, [isOpen])

  // Focus input when animation completes
  useEffect(() => {
    if (animDone) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [animDone])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const handleAnimComplete = useCallback(() => {
    setAnimDone(true)
  }, [])

  const runCommand = async (cmdOverride?: string): Promise<void> => {
    const cmd = (cmdOverride ?? command).trim()
    if (!cmd || isRunning || !animDone) return

    setIsRunning(true)
    if (cmdOverride === undefined) setCommand('')
    setHistoryIndex(-1)

    let output: string | null = null
    let isError = false

    try {
      const isLocalAdb = /^adb(\s|$)/i.test(cmd)
      if (isLocalAdb) {
        // Run locally with bundled adb — strip 'adb ' prefix (case-insensitive)
        const adbArgs = cmd.replace(/^adb\s*/i, '').trim()
        output = await window.api.adb.runLocalAdbCommand(adbArgs)
      } else {
        output = await window.api.adb.runShellCommand(deviceId, cmd)
      }
      if (!output) output = '(no output)'
    } catch (err) {
      output = err instanceof Error ? err.message : String(err)
      isError = true
    }

    setHistory((prev) => [
      ...prev,
      { command: cmd, output, error: isError }
    ])
    setIsRunning(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      runCommand()
      return
    }

    const cmds = history.map((h) => h.command)
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = historyIndex + 1
      if (nextIndex < cmds.length) {
        setHistoryIndex(nextIndex)
        setCommand(cmds[cmds.length - 1 - nextIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex <= 0) {
        setHistoryIndex(-1)
        setCommand('')
      } else {
        const nextIndex = historyIndex - 1
        setHistoryIndex(nextIndex)
        setCommand(cmds[cmds.length - 1 - nextIndex])
      }
    }
  }

  const promptLabel = `[${deviceId}@cyberdeck]$`

  return (
    <Dialog open={isOpen} onOpenChange={(_, { open }) => { if (!open) onDismiss() }}>
      <DialogSurface style={S.surface}>
        <DialogBody style={S.body}>

          {/* ── Title bar ── */}
          <DialogTitle style={{ padding: 0, margin: 0 }}>
            <div style={S.titleBar}>
              <span style={S.titleText}>[ADB SHELL — {deviceId}]</span>
              <span style={{
                fontFamily: "'Courier New', monospace",
                fontSize: '10px',
                letterSpacing: '0.15em',
                color: 'rgba(var(--vrcd-neon-raw),0.35)',
                userSelect: 'none'
              }}>
                SECURE TERMINAL
              </span>
            </div>
          </DialogTitle>

          {/* ── Content ── */}
          <DialogContent style={S.content}>

            {/* Quick command shortcuts — only after the matrix animation finishes
                so they don't appear over the intro */}
            {animDone && (
              <AdbShortcuts onRun={(cmd) => runCommand(cmd)} disabled={isRunning} />
            )}

            {/* Terminal area — wraps both the animation overlay and the terminal output */}
            <div
              ref={containerRef}
              style={{ position: 'relative' }}
            >
              {/* Matrix intro — shown until animDone (skipped when disabled) */}
              {!animDone && matrixEnabled && (
                <MatrixIntro
                  onComplete={handleAnimComplete}
                  width={dialogSize.w}
                  height={360}
                  holdMs={PHASE_2_HOLD}
                  username={matrixUsername}
                />
              )}

              {/* Terminal output */}
              <div
                ref={terminalRef}
                style={{
                  ...S.terminal,
                  // Keep in DOM but invisible while animation plays (so refs work)
                  visibility: animDone ? 'visible' : 'hidden'
                }}
                onClick={() => inputRef.current?.focus()}
              >
                {history.length === 0 && (
                  <span style={S.emptyHint}>// type a shell command and press Enter</span>
                )}

                {history.map((entry, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', gap: '0' }}>
                      <span style={S.prompt}>{promptLabel}</span>
                      <span style={S.commandText}>&nbsp;{entry.command}</span>
                    </div>
                    {entry.output !== null && (
                      <div style={entry.error ? S.errorText : S.outputText}>
                        {entry.typingDone ? entry.output : (entry.rendered ?? '')}
                        {!entry.typingDone && (
                          <span style={{ opacity: 0.7 }}>▌</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isRunning && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={S.prompt}>{promptLabel}</span>
                    <span style={{ color: 'rgba(var(--vrcd-neon-raw),0.5)', fontFamily: "'Courier New', monospace" }}>
                      executing...
                    </span>
                  </div>
                )}
              </div>

              {/* Input row — also hidden during animation */}
              <div
                style={{
                  ...S.inputRow,
                  visibility: animDone ? 'visible' : 'hidden',
                  marginTop: '8px'
                }}
              >
                <span style={{
                  ...S.prompt,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontSize: '12px'
                }}>
                  {promptLabel}
                </span>
                <FlashInput
                  value={command}
                  onChange={setCommand}
                  onKeyDown={handleKeyDown}
                  disabled={isRunning || !animDone}
                  inputRef={inputRef}
                />
                <NeonButton
                  onClick={runCommand}
                  disabled={!command.trim() || isRunning || !animDone}
                >
                  RUN
                </NeonButton>
              </div>
            </div>

          </DialogContent>

          {/* ── Actions ── */}
          <DialogActions style={{ padding: 0, margin: 0 }}>
            <div style={S.actions}>
              <NeonButton onClick={() => setHistory([])}>
                CLEAR
              </NeonButton>
              <NeonButton onClick={onDismiss}>
                CLOSE
              </NeonButton>
            </div>
          </DialogActions>

        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
