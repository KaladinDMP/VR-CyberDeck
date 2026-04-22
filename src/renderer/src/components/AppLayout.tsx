import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AdbProvider } from '../context/AdbProvider'
import { GamesProvider } from '../context/GamesProvider'
import DeviceList from './DeviceList'
import GamesView from './GamesView'
import DownloadsView from './DownloadsView'
import UploadsView from './UploadsView'
import Settings from './Settings'
import { UpdateNotification } from './UpdateNotification'
import UploadGamesDialog from './UploadGamesDialog'
import {
  FluentProvider,
  makeStyles,
  tokens,
  Spinner,
  Text,
  teamsDarkTheme,
  teamsLightTheme,
  Button,
  Switch,
  Drawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  TabList,
  Tab,
  Dialog,
  DialogSurface,
  DialogBody
} from '@fluentui/react-components'
import electronLogo from '../assets/icon.svg'
import { useDependency } from '../hooks/useDependency'
import { DependencyProvider } from '../context/DependencyProvider'
import { DownloadProvider } from '../context/DownloadProvider'
import { SettingsProvider } from '../context/SettingsProvider'
import { useDownload } from '../hooks/useDownload'
import {
  ArrowDownloadRegular as DownloadIcon,
  DismissRegular as CloseIcon,
  DesktopRegular,
  SettingsRegular,
  ArrowUploadRegular as UploadIcon
} from '@fluentui/react-icons'
import { UploadProvider } from '@renderer/context/UploadProvider'
import { useUpload } from '@renderer/hooks/useUpload'
import { GameDialogProvider } from '@renderer/context/GameDialogProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { LanguageProvider } from '@renderer/context/LanguageProvider'
import { useLanguage } from '@renderer/hooks/useLanguage'
import CreditsDialog from './CreditsDialog'
import HackerConsole from './HackerConsole'
import { ErrorBoundary } from './ErrorBoundary'
import '../assets/credits-dialog.css'

enum AppView {
  DEVICE_LIST,
  GAMES
}

// Type for app tab navigation
type ActiveTab = 'games' | 'settings'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottom: '1px solid rgba(57, 255, 20, 0.2)',
    backgroundColor: '#050514',
    backgroundImage:
      'linear-gradient(rgba(57, 255, 20, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 255, 20, 0.03) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    boxShadow: '0 1px 24px 0 rgba(57, 255, 20, 0.06), inset 0 -1px 0 rgba(176, 64, 255, 0.12)',
    height: '110px',
    flexShrink: 0
  },
  headerCenter: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: `${tokens.spacingVerticalS} 0`
  },
  headerRight: {
    width: '190px',
    minWidth: '190px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeft: '1px solid rgba(57,255,20,0.12)',
    flexShrink: 0
  },
  logo: {
    height: '58px',
    filter:
      'drop-shadow(0 0 8px #39ff14) drop-shadow(0 0 18px rgba(168, 85, 247, 0.8))'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalM
  },
  titleSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px'
  },
  titleMain: {
    fontSize: '32px',
    fontWeight: '800',
    letterSpacing: '0.06em',
    background: 'linear-gradient(100deg, #39ff14 0%, #a855f7 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    lineHeight: '1.1',
    textShadow: 'none'
  },
  titleSub: {
    fontSize: '11px',
    letterSpacing: '0.22em',
    fontFamily: 'monospace',
    color: 'rgba(57, 255, 20, 0.7)',
    lineHeight: '1.2'
  },
  titleCredit: {
    fontSize: '10px',
    letterSpacing: '0.14em',
    fontFamily: 'monospace',
    color: 'rgba(57, 255, 20, 0.45)',
    lineHeight: '1.2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    width: '100%',
    textTransform: 'uppercase'
  },
  mainContent: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: 'calc(100vh - 110px)',
    position: 'relative'
  },
  loadingOrErrorContainer: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalL
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM
  },
  tabs: {
    marginLeft: tokens.spacingHorizontalM,
    marginRight: tokens.spacingHorizontalM
  }
})

interface MainContentProps {
  currentView: AppView
  onDeviceConnected: () => void
  onSkipConnection: () => void
  onBackToDeviceList: () => void
  onTransfers: () => void
  onSettings: () => void
}

const MainContent: React.FC<MainContentProps> = ({
  currentView,
  onDeviceConnected,
  onSkipConnection,
  onBackToDeviceList,
  onTransfers,
  onSettings
}) => {
  const styles = useStyles()
  const {
    isReady: dependenciesReady,
    error: dependencyError,
    progress: dependencyProgress,
    status: dependencyStatus
  } = useDependency()

  const renderCurrentView = (): React.ReactNode => {
    if (currentView === AppView.DEVICE_LIST) {
      return <DeviceList onConnected={onDeviceConnected} onSkip={onSkipConnection} />
    }
    return <GamesView onBackToDevices={onBackToDeviceList} onTransfers={onTransfers} onSettings={onSettings} />
  }

  if (!dependenciesReady) {
    if (dependencyError) {
      // Check if this is a connectivity error
      if (dependencyError.startsWith('CONNECTIVITY_ERROR|')) {
        const failedUrls = dependencyError.replace('CONNECTIVITY_ERROR|', '').split('|')

        return (
          <div className={styles.loadingOrErrorContainer}>
            <Text weight="semibold" style={{ color: tokens.colorPaletteRedForeground1 }}>
              Network Connectivity Issues
            </Text>
            <Text>Cannot reach the following services:</Text>
            <ul style={{ textAlign: 'left', marginTop: tokens.spacingVerticalS }}>
              {failedUrls.map((url, index) => (
                <li key={index} style={{ marginBottom: tokens.spacingVerticalXS }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>{url}</Text>
                </li>
              ))}
            </ul>
            <Text style={{ marginTop: tokens.spacingVerticalM }}>
              This is likely due to DNS or firewall restrictions. Please try:
            </Text>
            <ol style={{ textAlign: 'left', marginTop: tokens.spacingVerticalS }}>
              <li style={{ marginBottom: tokens.spacingVerticalXS }}>
                <Text>Change your DNS to Cloudflare (1.1.1.1) or Google (8.8.8.8)</Text>
              </li>
              <li style={{ marginBottom: tokens.spacingVerticalXS }}>
                <Text>Use a VPN like ProtonVPN or 1.1.1.1 VPN</Text>
              </li>
              <li style={{ marginBottom: tokens.spacingVerticalXS }}>
                <Text>Check your router/firewall settings</Text>
              </li>
            </ol>
            <Text style={{ marginTop: tokens.spacingVerticalM }}>
              For detailed troubleshooting, see:{' '}
              <a
                href="https://github.com/jimzrt/apprenticeVr#troubleshooting-guide"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: tokens.colorBrandForeground1 }}
              >
                Troubleshooting Guide
              </a>
            </Text>
          </div>
        )
      }

      // Handle other dependency errors
      const errorDetails: string[] = []
      if (!dependencyStatus?.sevenZip.ready) errorDetails.push('7zip')
      if (!dependencyStatus?.rclone.ready) errorDetails.push('rclone')
      if (!dependencyStatus?.adb.ready) errorDetails.push('adb')

      const failedDeps = errorDetails.length > 0 ? ` (${errorDetails.join(', ')})` : ''

      return (
        <div className={styles.loadingOrErrorContainer}>
          <Text weight="semibold" style={{ color: tokens.colorPaletteRedForeground1 }}>
            Dependency Error {failedDeps}
          </Text>
          <Text>{dependencyError}</Text>
        </div>
      )
    }
    let progressText = 'Checking requirements...'

    if (dependencyProgress?.name === 'connectivity-check') {
      progressText = `Checking network connectivity... ${dependencyProgress.percentage}%`
    } else if (dependencyStatus?.rclone.downloading && dependencyProgress) {
      progressText = `Setting up ${dependencyProgress.name}... ${dependencyProgress.percentage}%`
      if (dependencyProgress.name === 'rclone-extract') {
        progressText = `Extracting ${dependencyProgress.name.replace('-extract', '')}...`
      }
    } else if (dependencyStatus?.adb.downloading && dependencyProgress) {
      progressText = `Setting up ${dependencyProgress.name}... ${dependencyProgress.percentage}%`
      if (dependencyProgress.name === 'adb-extract') {
        progressText = `Extracting ${dependencyProgress.name.replace('-extract', '')}...`
      }
    } else if (
      dependencyStatus &&
      (!dependencyStatus.sevenZip.ready ||
        !dependencyStatus.rclone.ready ||
        !dependencyStatus.adb.ready)
    ) {
      progressText = 'Setting up requirements...'
    }

    return (
      <div className={styles.loadingOrErrorContainer}>
        <Spinner size="huge" />
        <Text>{progressText}</Text>
      </div>
    )
  }

  return (
    <>
      <UploadGamesDialog />
      {renderCurrentView()}
    </>
  )
}

const AppLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DEVICE_LIST)
  const { colorScheme, setColorScheme } = useSettings()
  const [isTransfersOpen, setIsTransfersOpen] = useState(false)
  const [transfersTab, setTransfersTab] = useState<'downloads' | 'uploads'>('downloads')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCreditsOpen, setIsCreditsOpen] = useState(false)
  const [isDarkModeJokeOpen, setIsDarkModeJokeOpen] = useState(false)
  const mountNodeRef = useRef<HTMLDivElement>(null)
  const styles = useStyles()
  const { queue: downloadQueue } = useDownload()
  const { queue: uploadQueue } = useUpload()
  const { t } = useLanguage()

  const handleDeviceConnected = (): void => {
    setCurrentView(AppView.GAMES)
  }

  const handleSkipConnection = (): void => {
    setCurrentView(AppView.GAMES)
  }

  const handleBackToDeviceList = (): void => {
    setCurrentView(AppView.DEVICE_LIST)
  }

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent): void => {
      setColorScheme(e.matches ? 'dark' : 'light')
    }

    darkModeMediaQuery.addEventListener('change', handleChange)

    return () => {
      darkModeMediaQuery.removeEventListener('change', handleChange)
    }
  }, [setColorScheme])

  const currentTheme = colorScheme === 'dark' ? teamsDarkTheme : teamsLightTheme

  return (
    <FluentProvider theme={currentTheme}>
      <AdbProvider>
        <GamesProvider>
          <GameDialogProvider>
            <div className={styles.root}>
              <div className={styles.header}>
                {/* Left: Hacker Console */}
                <HackerConsole />

                {/* Center: Logo + title */}
                <div className={styles.headerCenter}>
                  <div className={styles.headerContent}>
                    <img alt="logo" className={styles.logo} src={electronLogo} />
                    <div className={styles.titleSection}>
                      <span className={styles.titleMain}>VR CYBERDECK</span>
                      <span className={styles.titleSub}>OPERATE. DEPLOY. CONTROL.</span>
                    </div>
                  </div>
                  <span className={styles.titleCredit}>
                    Made with ♥ by DMP
                    <button
                      className="credits-question-btn"
                      onClick={() => setIsCreditsOpen(true)}
                      title="Credits"
                      style={{ marginLeft: '4px' }}
                    >
                      ?
                    </button>
                  </span>
                </div>

                {/* Right: Dark mode toggle (decorative joke) */}
                <div className={styles.headerRight}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => setIsDarkModeJokeOpen(true)}>
                    <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.12em', color: 'rgba(57,255,20,0.6)', textTransform: 'uppercase' }}>Dark Mode</span>
                    <div style={{ '--colorBrandBackground': '#39ff14', '--colorBrandBackgroundHover': 'rgba(57,255,20,0.8)', '--colorBrandBackgroundPressed': 'rgba(57,255,20,0.6)', '--colorCompoundBrandBackground': '#39ff14', '--colorCompoundBrandBackgroundHover': 'rgba(57,255,20,0.8)', pointerEvents: 'none' } as React.CSSProperties}>
                      <Switch checked={true} readOnly />
                    </div>
                  </div>
                </div>

                {/* Dark mode joke dialog */}
                <Dialog open={isDarkModeJokeOpen} onOpenChange={(_, d) => setIsDarkModeJokeOpen(d.open)}>
                  <DialogSurface style={{ background: '#030310', border: '1px solid rgba(57,255,20,0.35)', maxWidth: '520px', width: '90vw', fontFamily: 'monospace', boxShadow: '0 0 40px rgba(57,255,20,0.07)' }}>
                    <DialogBody>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '4px 0 8px', textAlign: 'center' }}>

                        {/* Binary smiley face SVG */}
                        <svg width="240" height="200" viewBox="-20 0 240 200" style={{ overflow: 'visible' }}>
                          <defs>
                            <path id="jk-ring" d="M 100,16 A 84,84 0 0,1 184,100 A 84,84 0 0,1 100,184 A 84,84 0 0,1 16,100 A 84,84 0 0,1 100,16"/>
                            <filter id="jk-g" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur stdDeviation="2.5" result="b"/>
                              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                            <filter id="jk-pg" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur stdDeviation="2" result="b"/>
                              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                          </defs>

                          {/* Circular binary ring */}
                          <text fill="#39ff14" fontFamily="'Courier New',monospace" fontSize="8.5" filter="url(#jk-g)">
                            <textPath href="#jk-ring">10110100 01001011 10110100 01001011 10110100 01001011 10110100 01001011 10110100 01001011 10110100 01</textPath>
                          </text>

                          {/* Eyes */}
                          <text x="72" y="98" fill="#39ff14" fontFamily="'Courier New',monospace" fontSize="18" fontWeight="bold" filter="url(#jk-g)" textAnchor="middle">◉</text>
                          <text x="128" y="98" fill="#39ff14" fontFamily="'Courier New',monospace" fontSize="18" fontWeight="bold" filter="url(#jk-g)" textAnchor="middle">◉</text>

                          {/* Wide smile arc */}
                          <path d="M 58,128 Q 100,162 142,128" fill="none" stroke="#39ff14" strokeWidth="3.5" strokeLinecap="round" filter="url(#jk-g)"/>

                          {/* Left tear block */}
                          <text x="-18" y="84" fill="rgba(176,64,255,0.9)" fontFamily="'Courier New',monospace" fontSize="8.5" filter="url(#jk-pg)">85305</text>
                          <text x="-18" y="95" fill="rgba(176,64,255,0.9)" fontFamily="'Courier New',monospace" fontSize="8.5" filter="url(#jk-pg)">33850</text>
                          <text x="-18" y="106" fill="rgba(176,64,255,0.9)" fontFamily="'Courier New',monospace" fontSize="8.5" filter="url(#jk-pg)">01101</text>
                          <text x="-18" y="117" fill="rgba(176,64,255,0.9)" fontFamily="'Courier New',monospace" fontSize="8.5" filter="url(#jk-pg)">10011</text>

                          {/* Right tear block */}
                          <text x="163" y="84" fill="rgba(176,64,255,0.9)" fontFamily="'Courier New',monospace" fontSize="8.5" filter="url(#jk-pg)">58503</text>
                          <text x="163" y="95" fill="rgba(176,64,255,0.9)" fontFamily="'Courier New',monospace" fontSize="8.5" filter="url(#jk-pg)">05833</text>
                          <text x="163" y="106" fill="rgba(176,64,255,0.9)" fontFamily="'Courier New',monospace" fontSize="8.5" filter="url(#jk-pg)">11010</text>
                          <text x="163" y="117" fill="rgba(176,64,255,0.9)" fontFamily="'Courier New',monospace" fontSize="8.5" filter="url(#jk-pg)">11001</text>
                        </svg>

                        {/* LMAO */}
                        <div style={{ fontSize: '44px', color: '#39ff14', letterSpacing: '0.18em', fontWeight: 900, fontFamily: '"Courier New", monospace', textShadow: '0 0 8px #39ff14, 0 0 20px rgba(57,255,20,0.5), 0 0 50px rgba(57,255,20,0.2)', marginTop: '-6px' }}>LMAO</div>

                        {/* Purple circuit divider */}
                        <div style={{ display: 'flex', alignItems: 'center', width: '88%' }}>
                          <span style={{ color: 'rgba(176,64,255,0.8)', fontFamily: 'monospace', fontSize: '13px', flexShrink: 0 }}>⊣─</span>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(176,64,255,0.55)', boxShadow: '0 0 5px rgba(176,64,255,0.4)' }}/>
                          <span style={{ color: 'rgba(176,64,255,0.95)', fontSize: '14px', textShadow: '0 0 7px rgba(176,64,255,0.8)', margin: '0 6px', flexShrink: 0 }}>◆</span>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(176,64,255,0.55)', boxShadow: '0 0 5px rgba(176,64,255,0.4)' }}/>
                          <span style={{ color: 'rgba(176,64,255,0.8)', fontFamily: 'monospace', fontSize: '13px', flexShrink: 0 }}>─⊢</span>
                        </div>

                        {/* Body text */}
                        <div style={{ fontSize: '15px', color: '#39ff14', lineHeight: 1.9, fontFamily: '"Courier New", monospace', textShadow: '0 0 5px rgba(57,255,20,0.3)', marginTop: '2px' }}>
                          This is just for looks.<br />
                          Do people actually USE light mode?
                        </div>

                        <button onClick={() => setIsDarkModeJokeOpen(false)} style={{ marginTop: '4px', background: 'transparent', border: '1px solid rgba(57,255,20,0.5)', color: '#39ff14', fontFamily: '"Courier New", monospace', fontSize: '12px', letterSpacing: '0.1em', padding: '8px 24px', borderRadius: '4px', cursor: 'pointer', fontStyle: 'italic', boxShadow: '0 0 8px rgba(57,255,20,0.1)' }}>
                          [ *Cries in binary* ]
                        </button>
                      </div>
                    </DialogBody>
                  </DialogSurface>
                </Dialog>
              </div>

              <div className={styles.mainContent} id="mainContent">
                <MainContent
                  currentView={currentView}
                  onDeviceConnected={handleDeviceConnected}
                  onSkipConnection={handleSkipConnection}
                  onBackToDeviceList={handleBackToDeviceList}
                  onTransfers={() => setIsTransfersOpen(true)}
                  onSettings={() => setIsSettingsOpen(true)}
                />
              </div>

              {/* Add UpdateNotification component here - it manages its own visibility */}
              <UpdateNotification />

              {/* Transfers drawer (Downloads + Uploads combined) */}
              <Drawer
                type="overlay"
                separator
                open={isTransfersOpen}
                onOpenChange={(_, { open }) => setIsTransfersOpen(open)}
                position="end"
                style={{ width: '700px' }}
                mountNode={mountNodeRef.current}
              >
                <DrawerHeader>
                  <DrawerHeaderTitle
                    action={
                      <Button
                        appearance="subtle"
                        aria-label={t('close')}
                        icon={<CloseIcon />}
                        onClick={() => setIsTransfersOpen(false)}
                      />
                    }
                  >
                    Transfers
                  </DrawerHeaderTitle>
                </DrawerHeader>
                <DrawerBody style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                  <TabList
                    selectedValue={transfersTab}
                    onTabSelect={(_, d) => setTransfersTab(d.value as 'downloads' | 'uploads')}
                    style={{ padding: '0 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, flexShrink: 0 }}
                  >
                    <Tab value="downloads" icon={<DownloadIcon />}>{t('downloads')}</Tab>
                    <Tab value="uploads" icon={<UploadIcon />}>{t('uploads')}</Tab>
                  </TabList>
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    {transfersTab === 'downloads' ? (
                      <DownloadsView onClose={() => setIsTransfersOpen(false)} />
                    ) : (
                      <UploadsView />
                    )}
                  </div>
                </DrawerBody>
              </Drawer>

              {/* Settings modal — custom overlay bypasses Fluent Dialog width constraints */}
              {isSettingsOpen && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(2px)'
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setIsSettingsOpen(false)
                  }}
                >
                  <div
                    style={{
                      width: '96vw',
                      maxWidth: '1400px',
                      maxHeight: '92vh',
                      background: '#050514',
                      border: '1px solid rgba(57,255,20,0.25)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: '0 0 40px rgba(57,255,20,0.06)'
                    }}
                  >
                    <Button
                      appearance="subtle"
                      icon={<CloseIcon />}
                      aria-label={t('close')}
                      onClick={() => setIsSettingsOpen(false)}
                      style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, color: '#39ff14' }}
                    />
                    <Settings />
                  </div>
                </div>
              )}
            </div>
            <div
              id="portal-parent"
              style={{
                zIndex: 1000,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none'
              }}
            >
              <div ref={mountNodeRef} id="portal" style={{ pointerEvents: 'auto' }}></div>
            </div>
          </GameDialogProvider>
        </GamesProvider>
      </AdbProvider>
      <CreditsDialog
        open={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
        variant="main"
      />
    </FluentProvider>
  )
}

const AppLayoutWithProviders: React.FC = () => {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <LanguageProvider>
          <DependencyProvider>
            <DownloadProvider>
              <UploadProvider>
                <AppLayout />
              </UploadProvider>
            </DownloadProvider>
          </DependencyProvider>
        </LanguageProvider>
      </SettingsProvider>
    </ErrorBoundary>
  )
}

export default AppLayoutWithProviders
