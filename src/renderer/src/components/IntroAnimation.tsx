import React, { useEffect, useRef, useState } from 'react'

const POOL_USERNAMES = ['DMP', 'DeliciousMeatPop', 'KaladinDMP', 'SickSoThr33', 'G4M3R_0NE', 'CyberN4ut']
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

// Phase enum keeps the render logic clean
type Phase = 'boot' | 'typing' | 'auth' | 'glitch' | 'authorized' | 'fade'

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<Phase>('boot')
  const [committedLines, setCommittedLines] = useState<string[]>([])
  const [activeLine, setActiveLine] = useState('')
  const [cursorOn, setCursorOn] = useState(true)
  const [glitchBg, setGlitchBg] = useState('#000000')
  const [glitchShift, setGlitchShift] = useState(0)
  // AUTHORIZED blink state
  const [authorizedVisible, setAuthorizedVisible] = useState(false)
  const [authorizedBlink, setAuthorizedBlink] = useState(true)
  const [fading, setFading] = useState(false)
  const dead = useRef(false)

  // cursor blink
  useEffect(() => {
    const t = setInterval(() => setCursorOn((v) => !v), 530)
    return () => clearInterval(t)
  }, [])

  // AUTHORIZED flicker — irregular timing for glitch feel
  useEffect(() => {
    if (!authorizedVisible) return
    let cancelled = false
    const flicker = async (): Promise<void> => {
      while (!cancelled && !dead.current) {
        await sleep(rand(80, 280))
        if (!cancelled) setAuthorizedBlink((v) => !v)
      }
    }
    flicker()
    return () => { cancelled = true }
  }, [authorizedVisible])

  useEffect(() => {
    let systemUser = ''
    const run = async (): Promise<void> => {
      try {
        systemUser = await window.api.app.getSystemUsername()
      } catch {
        // use pool
      }

      const allNames = [...POOL_USERNAMES]
      if (systemUser && !allNames.includes(systemUser)) allNames.push(systemUser)
      const username = allNames[rand(0, allNames.length - 1)]

      // ── Phase 1: boot cursor, 1.5s ──────────────────────────────
      await sleep(1500)
      if (dead.current) return
      setPhase('typing')

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

      // ── Phase 5: glitch flash ────────────────────────────────────
      setPhase('glitch')
      setCommittedLines((prev) => [...prev, '> AUTHENTICATING...'])
      setActiveLine('')

      const flashSequence = [
        { color: '#00d4ff', delay: 300 },
        { color: '#ff00ff', delay: 240 },
        { color: '#ff0000', delay: 190 },
        { color: '#00d4ff', delay: 150 },
        { color: '#ff00ff', delay: 110 },
        { color: '#ff0000', delay: 85 },
        { color: '#00d4ff', delay: 65 },
        { color: '#ff00ff', delay: 50 },
        { color: '#ffffff', delay: 120 }
      ]

      for (const { color, delay } of flashSequence) {
        if (dead.current) return
        setGlitchBg(color)
        setGlitchShift(rand(-8, 8))
        await sleep(delay)
      }

      // ── Phase 6: AUTHORIZED — blink for 2.5s ────────────────────
      setPhase('authorized')
      setGlitchBg('#000000')
      setGlitchShift(0)
      setAuthorizedVisible(true)
      await sleep(2600)
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

  const isGlitching = phase === 'glitch'

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isGlitching ? glitchBg : '#000000',
    opacity: fading ? 0 : 1,
    transition: fading ? 'opacity 1.5s ease-in-out' : 'none',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '17px',
    color: '#39ff14',
    overflow: 'hidden',
    userSelect: 'none'
  }

  const terminalStyle: React.CSSProperties = {
    width: '440px',
    transform: isGlitching ? `translateX(${glitchShift}px)` : 'none'
  }

  const authorizedStyle: React.CSSProperties = {
    position: 'absolute',
    fontSize: '54px',
    fontWeight: 900,
    letterSpacing: '0.1em',
    color: authorizedBlink ? '#39ff14' : '#a855f7',
    textShadow: authorizedBlink
      ? '0 0 20px #39ff14, 0 0 50px rgba(57,255,20,0.5)'
      : '0 0 20px #a855f7, 0 0 50px rgba(168,85,247,0.5)',
    transform: `translateX(${rand(-2, 2)}px)`,
    transition: 'color 0.05s, text-shadow 0.05s'
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
          <div>VR CYBERDECK v0.0.1</div>
          <div>SECURE TERMINAL — DELICIOUSMEATPOP</div>
          <div>STATUS: {phase === 'authorized' ? 'ACCESS GRANTED' : 'CONNECTING...'}</div>
        </div>
      )}

      {/* terminal output */}
      {phase !== 'authorized' && (
        <div style={terminalStyle}>
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

      {/* AUTHORIZED flash */}
      {authorizedVisible && (
        <div style={authorizedStyle}>ACCESS GRANTED</div>
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
