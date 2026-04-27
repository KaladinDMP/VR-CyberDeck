import React, { useEffect, useRef, useState } from 'react'
import { getMatrixUsername } from '../utils/matrixUsername'
import { playSoundOnce } from '../hooks/useSoundEffects'

const TYPO_CHARS = 'asdfjkl;qwertyuiop'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

interface IntroAnimationProps {
  onComplete: () => void
}

type Phase = 'boot' | 'typing' | 'auth' | 'unauthorized' | 'authorized' | 'fade'

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<Phase>('boot')
  const [committedLines, setCommittedLines] = useState<string[]>([])
  const [activeLine, setActiveLine] = useState('')
  const [cursorOn, setCursorOn] = useState(true)
  const [textJitter, setTextJitter] = useState({ x: 0, y: 0 })
  const [fading, setFading] = useState(false)
  const [appVersion, setAppVersion] = useState('0.0.1')
  const dead = useRef(false)

  useEffect(() => {
    window.api.app.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  // cursor blink
  useEffect(() => {
    const t = setInterval(() => setCursorOn((v) => !v), 530)
    return () => clearInterval(t)
  }, [])

  // Aggressive jitter during UNAUTHORIZED — fast, pronounced
  useEffect(() => {
    if (phase !== 'unauthorized') return
    const t = setInterval(() => setTextJitter({ x: rand(-6, 6), y: rand(-3, 3) }), 80)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    let systemUser = ''
    const run = async (): Promise<void> => {
      try {
        systemUser = await window.api.app.getSystemUsername()
      } catch {
        // use pool
      }

      const username = getMatrixUsername() || systemUser || 'n30'

      // ── Phase 1: boot cursor, 1.5s ──────────────────────────────
      await sleep(1500)
      if (dead.current) return
      setPhase('typing')

      // Fire the typing sound once for the whole sequence (the audio clip
      // is itself a multi-second loop of keystrokes), instead of per-char.
      playSoundOnce('type')

      // ── Phase 2: type username ───────────────────────────────────
      const userPrompt = '$USER: '
      let typed = ''
      setActiveLine(userPrompt)
      await sleep(rand(150, 250))

      const hasTypo = Math.random() < 0.7
      const typoAt = hasTypo ? rand(1, Math.max(1, username.length - 2)) : -1

      for (let i = 0; i < username.length; i++) {
        if (dead.current) return
        await sleep(rand(70, 190))

        if (i === typoAt) {
          const wrongChar = TYPO_CHARS[rand(0, TYPO_CHARS.length - 1)]
          typed += wrongChar
          setActiveLine(userPrompt + typed)
          await sleep(rand(250, 450))
          typed = typed.slice(0, -1)
          setActiveLine(userPrompt + typed)
          await sleep(rand(100, 200))
        }

        typed += username[i]
        setActiveLine(userPrompt + typed)
      }

      await sleep(rand(300, 500))
      if (dead.current) return
      setCommittedLines((prev) => [...prev, userPrompt + typed])
      setActiveLine('')

      // ── Phase 3: type password ───────────────────────────────────
      const passPrompt = '$PASS: '
      setActiveLine(passPrompt)
      await sleep(rand(200, 320))

      const targetLen = rand(8, 14)
      let stars = ''
      const burstLen = rand(Math.max(3, targetLen - 4), targetLen - 1)

      for (let i = 0; i < burstLen; i++) {
        if (dead.current) return
        await sleep(rand(100, 180))
        stars += '*'
        setActiveLine(passPrompt + stars)
      }

      const backCount = rand(2, Math.min(4, stars.length - 1))
      for (let i = 0; i < backCount; i++) {
        if (dead.current) return
        await sleep(rand(80, 160))
        stars = stars.slice(0, -1)
        setActiveLine(passPrompt + stars)
      }

      while (stars.length < targetLen) {
        if (dead.current) return
        await sleep(rand(100, 180))
        stars += '*'
        setActiveLine(passPrompt + stars)
      }

      await sleep(rand(350, 550))
      if (dead.current) return
      setCommittedLines((prev) => [...prev, passPrompt + stars])
      setActiveLine('')

      // ── Phase 4: system messages ─────────────────────────────────
      setPhase('auth')
      await sleep(300)
      setActiveLine('> INITIALIZING CONNECTION...')
      await sleep(1400)
      if (dead.current) return

      setCommittedLines((prev) => [...prev, '> INITIALIZING CONNECTION...'])
      setActiveLine('> AUTHENTICATING...')
      await sleep(2200)
      if (dead.current) return

      // ── Phase 5: hard cut → UNAUTHORIZED — hold 4s ───────────────
      setPhase('unauthorized')
      setCommittedLines((prev) => [...prev, '> AUTHENTICATING...'])
      setActiveLine('')
      await sleep(4000)
      if (dead.current) return

      // ── Phase 6: UN + ! vanish → AUTHORIZED in green, 1.2s ───────
      setPhase('authorized')
      await sleep(1200)
      if (dead.current) return

      // ── Phase 7: fade out ─────────────────────────────────────────
      setPhase('fade')
      setFading(true)
      await sleep(1500)
      if (!dead.current) onComplete()
    }

    run()
    return () => { dead.current = true }
  }, [onComplete])

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: phase === 'unauthorized' ? '#0c0000' : '#000000',
    opacity: fading ? 0 : 1,
    transition: fading ? 'opacity 1.5s ease-in-out' : phase === 'unauthorized' ? 'background-color 0.1s' : 'none',
    fontFamily: 'var(--vrcd-font-mono)',
    fontSize: '17px',
    color: '#39ff14',
    overflow: 'hidden',
    userSelect: 'none'
  }

  const bigTextStyle: React.CSSProperties = {
    position: 'absolute',
    fontSize: '62px',
    fontWeight: 900,
    letterSpacing: '0.08em',
    fontFamily: 'var(--vrcd-font-mono)'
  }

  const unauthorizedStyle: React.CSSProperties = {
    ...bigTextStyle,
    color: '#ff1a1a',
    textShadow: '0 0 20px #ff0000, 0 0 50px rgba(255,0,0,0.6), 0 0 100px rgba(255,0,0,0.25)',
    transform: `translate(${textJitter.x}px, ${textJitter.y}px)`
  }

  const authorizedStyle: React.CSSProperties = {
    ...bigTextStyle,
    color: '#39ff14',
    textShadow: '0 0 24px #39ff14, 0 0 60px rgba(57,255,20,0.5)',
    transition: 'color 0.15s, text-shadow 0.15s'
  }

  return (
    <div style={containerStyle}>
      {/* top-left boot badge */}
      {phase !== 'boot' && (
        <div style={{
          position: 'absolute', top: 36, left: 40,
          color: 'rgba(57,255,20,0.4)', fontSize: '11px',
          lineHeight: '1.6', letterSpacing: '0.08em'
        }}>
          <div>VR CYBERDECK v{appVersion}</div>
          <div>SECURE TERMINAL — DELICIOUSMEATPOP</div>
          <div>STATUS: {phase === 'authorized' || phase === 'fade' ? 'ACCESS GRANTED' : phase === 'unauthorized' ? 'ACCESS DENIED' : 'CONNECTING...'}</div>
        </div>
      )}

      {/* terminal output — hidden during the big-text phases */}
      {phase !== 'unauthorized' && phase !== 'authorized' && phase !== 'fade' && (
        <div style={{ width: '440px' }}>
          {committedLines.map((line, i) => (
            <div key={i} style={{ whiteSpace: 'pre', opacity: 0.85 }}>{line}</div>
          ))}
          <div style={{ whiteSpace: 'pre' }}>
            {activeLine}
            {cursorOn
              ? <span style={{ color: '#39ff14' }}>█</span>
              : <span style={{ opacity: 0 }}>█</span>
            }
          </div>
        </div>
      )}

      {/* UNAUTHORIZED! — red, holds, jitters */}
      {phase === 'unauthorized' && (
        <>
          <div style={unauthorizedStyle}>UNAUTHORIZED!</div>
          <div style={{
            position: 'absolute',
            bottom: '38%',
            fontSize: '13px',
            letterSpacing: '0.3em',
            color: 'rgba(255,60,60,0.55)',
            fontFamily: 'var(--vrcd-font-mono)'
          }}>
            ACCESS DENIED — AUTHENTICATION FAILED
          </div>
        </>
      )}

      {/* UN + ! stripped away → AUTHORIZED in green */}
      {(phase === 'authorized' || phase === 'fade') && (
        <div style={authorizedStyle}>AUTHORIZED</div>
      )}

      {/* bottom tagline */}
      <div style={{
        position: 'absolute', bottom: 30, right: 40,
        color: 'rgba(57,255,20,0.3)', fontSize: '10px', letterSpacing: '0.12em'
      }}>
        OPERATE. DEPLOY. CONTROL.
      </div>
    </div>
  )
}

export default IntroAnimation
