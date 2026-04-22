import { useState } from 'react'
import AppLayout from './components/AppLayout'
import IntroAnimation from './components/IntroAnimation'
import './assets/device-list.css'
import './assets/games-view.css'
import './assets/app.css'

const INTRO_STORAGE_KEY = 'vrcyberdeck:showIntro'

function shouldShowIntro(): boolean {
  try {
    const stored = localStorage.getItem(INTRO_STORAGE_KEY)
    return stored === null || stored === 'true'
  } catch {
    return true
  }
}

function App(): React.JSX.Element {
  const [introDone, setIntroDone] = useState(!shouldShowIntro())

  return (
    <div className="app-container">
      <AppLayout />
      {!introDone && <IntroAnimation onComplete={() => setIntroDone(true)} />}
    </div>
  )
}

export default App
