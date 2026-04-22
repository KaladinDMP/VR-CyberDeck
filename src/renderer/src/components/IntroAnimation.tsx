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

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [committedLines, setCommittedLines] = useState<string[]>([])
  const [activeLine, setActiveLine] = useState('')
  const [cursorOn, setCursorOn] = useState(true)
  const [glitching, setGlitching] = useState(false)
  const [glitchBg, setGlitchBg] = useState('#000000')
  const [glitchShift, setGlitchShift] = useState(0)
  const [showUnauthorized, setShowUnauthorized] = useState(false)
  const [fading, setFading] = useState(false)
  const dead = useRef(false)

  // cursor blink
  useEffect(() => {
    const t = setInterval(() => setCursorOn((v) => !v), 530)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let systemUser = ''
    const run = async (): Promise<void> => {
      try {
        systemUser = await window.api.app.getSystemUsername()
      } catch {
        // fall through to pool
      }

      const allNames = [...POOL_USERNAMES]
      if (systemUser && !allNames.includes(systemUser)) allNames.push(systemUser)
      const username = allNames[rand(0, allNames.length - 1)]

      // Phase 1 — pure black with blinking cursor for 1200ms
      await sleep(1200)
      if (dead.current) return

      // Phase 2 — type username (with one random typo ~70% of the time)
      const userPrompt = '$USER: '
      let typed = ''
      setActiveLine(userPrompt)
      await sleep(rand(120, 200))

      const hasTypo = Math.random() < 0.7
      const typoAt = hasTypo ? rand(1, Math.max(1, username.length - 2)) : -1

      for (let i = 0; i < username.length; i++) {
        if (dead.current) return
        await sleep(rand(55, 170))

        if (i === typoAt) {
          const wrongChar = TYPO_CHARS[rand(0, TYPO_CHARS.length - 1)]
          typed += wrongChar
          setActiveLine(userPrompt + typed)
          await sleep(rand(180, 380))
          typed = typed.slice(0, -1)
          setActiveLine(userPrompt + typed)
          await sleep(rand(80, 160))
        }

        typed += username[i]
        setActiveLine(userPrompt + typed)
      }

      await sleep(rand(250, 400))
      if (dead.current) return

      setCommittedLines((prev) => [...prev, userPrompt + typed])
      setActiveLine('')

      // Phase 3 — type password (asterisks with backspace/retype randomisation)
      const passPrompt = '$PASS: '
      setActiveLine(passPrompt)
      await sleep(rand(160, 280))

      const targetLen = rand(8, 14)
      let stars = ''

      // type initial burst
      const burstLen = rand(Math.max(3, targetLen - 4), targetLen - 1)
      for (let i = 0; i < burstLen; i++) {
        if (dead.current) return
        await sleep(rand(90, 160))
        stars += '*'
        setActiveLine(passPrompt + stars)
      }

      // backspace a few
      const backCount = rand(2, Math.min(4, stars.length - 1))
      for (let i = 0; i < backCount; i++) {
        if (dead.current) return
        await sleep(rand(70, 140))
        stars = stars.slice(0, -1)
        setActiveLine(passPrompt + stars)
      }

      // retype to reach target
      while (stars.length < targetLen) {
        if (dead.current) return
        await sleep(rand(90, 160))
        stars += '*'
        setActiveLine(passPrompt + stars)
      }

      await sleep(rand(300, 500))
      if (dead.current) return

      setCommittedLines((prev) => [...prev, passPrompt + stars])
      setActiveLine('')

      // Phase 4 — authenticating line, cursor hidden
      await sleep(200)
      setActiveLine('> AUTHENTICATING...')

      // 2 second pause
      await sleep(2000)
      if (dead.current) return

      // Phase 5 — glitch sequence: colour flashes accelerating to white
      setGlitching(true)
      const flashSequence = [
        { color: '#00d4ff', delay: 320 },
        { color: '#ff00ff', delay: 260 },
        { color: '#ff0000', delay: 200 },
        { color: '#00d4ff', delay: 160 },
        { color: '#ff00ff', delay: 120 },
        { color: '#ff0000', delay: 90 },
        { color: '#00d4ff', delay: 70 },
        { color: '#ff00ff', delay: 55 },
        { color: '#ffffff', delay: 150 }
      ]

      for (const { color, delay } of flashSequence) {
        if (dead.current) return
        setGlitchBg(color)
        setGlitchShift(rand(-6, 6))
        await sleep(delay)
      }

      if (dead.current) return

      // Phase 6 — UNAUTHORIZED flash
      setGlitchBg('#000000')
      setGlitching(false)
      setGlitchShift(0)
      setShowUnauthorized(true)
      await sleep(280)
      setShowUnauthorized(false)
      await sleep(80)

      // Phase 7 — fade out over 1.5s then call onComplete
      setFading(true)
      await sleep(1500)
      if (!dead.current) onComplete()
    }

    run()

    return () => {
      dead.current = true
    }
  }, [onComplete])

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: glitching ? glitchBg : '#000000',
    opacity: fading ? 0 : 1,
    transition: fading ? 'opacity 1.5s ease-in-out' : 'none',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '17px',
    color: '#39ff14',
    overflow: 'hidden',
    userSelect: 'none'
  }

  const terminalStyle: React.CSSProperties = {
    width: '420px',
    transform: glitching ? `translateX(${glitchShift}px)` : 'none'
  }

  return (
    <div style={containerStyle}>
      {/* top-left boot badge */}
      {committedLines.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: 40,
            color: 'rgba(57,255,20,0.4)',
            fontSize: '11px',
            lineHeight: '1.6',
            letterSpacing: '0.08em'
          }}
        >
          <div>VR CYBERDECK v0.0.1</div>
          <div>SECURE TERMINAL — DROID MASTER PROGRAM</div>
          <div>STATUS: CONNECTING...</div>
        </div>
      )}

      {/* terminal block */}
      <div style={terminalStyle}>
        {committedLines.map((line, i) => (
          <div key={i} style={{ whiteSpace: 'pre' }}>
            {line}
          </div>
        ))}

        <div style={{ whiteSpace: 'pre' }}>
          {activeLine}
          {cursorOn ? (
            <span style={{ color: '#39ff14' }}>█</span>
          ) : (
            <span style={{ opacity: 0 }}>█</span>
          )}
        </div>
      </div>

      {/* UNAUTHORIZED flash */}
      {showUnauthorized && (
        <div
          style={{
            position: 'absolute',
            fontSize: '52px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            color: '#ff0000',
            textShadow: '0 0 30px #ff0000, 0 0 60px rgba(255,0,0,0.5)',
            animation: 'none'
          }}
        >
          UNAUTHORIZED!
        </div>
      )}

      {/* bottom status bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          right: 40,
          color: 'rgba(57,255,20,0.3)',
          fontSize: '10px',
          letterSpacing: '0.12em'
        }}
      >
        OPERATE. DEPLOY. CONTROL.
      </div>
    </div>
  )
}

export default IntroAnimation
