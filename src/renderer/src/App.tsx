import { useState } from 'react'
import AppLayout from './components/AppLayout'
import IntroAnimation from './components/IntroAnimation'
import { shouldShowIntro } from './hooks/useExtrasSettings'
import './assets/games-view.css'
import './assets/app.css'

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
