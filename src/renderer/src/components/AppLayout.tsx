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
  CounterBadge
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
    borderBottom: '1px solid rgba(var(--vrcd-neon-raw), 0.2)',
    backgroundColor: '#050514',
    backgroundImage:
      'linear-gradient(rgba(var(--vrcd-neon-raw), 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--vrcd-neon-raw), 0.03) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    boxShadow: '0 1px 24px 0 rgba(var(--vrcd-neon-raw), 0.06), inset 0 -1px 0 rgba(var(--vrcd-purple-raw), 0.12)',
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
    borderLeft: '1px solid rgba(var(--vrcd-neon-raw), 0.12)',
    flexShrink: 0
  },
  logo: {
    height: '58px',
    filter:
      'drop-shadow(0 0 8px var(--vrcd-neon)) drop-shadow(0 0 18px rgba(var(--vrcd-purple-raw), 0.8))'
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
    lineHeight: '1.1',
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px'
  },
  titleVR: {
    color: 'var(--vrcd-purple)',
    textShadow: '0 0 18px rgba(var(--vrcd-purple-raw), 0.9), 0 0 40px rgba(var(--vrcd-purple-raw), 0.4)',
    fontFamily: '"Courier New", monospace'
  },
  titleCyberdeck: {
    color: 'var(--vrcd-neon)',
    textShadow: '0 0 18px rgba(var(--vrcd-neon-raw), 0.8), 0 0 40px rgba(var(--vrcd-neon-raw), 0.3)',
    fontFamily: '"Courier New", monospace',
    letterSpacing: '0.08em'
  },
  titleSub: {
    fontSize: '11px',
    letterSpacing: '0.22em',
    fontFamily: 'monospace',
    color: 'rgba(var(--vrcd-neon-raw), 0.7)',
    lineHeight: '1.2'
  },
  titleCredit: {
    fontSize: '10px',
    letterSpacing: '0.14em',
    fontFamily: 'monospace',
    color: 'rgba(var(--vrcd-neon-raw), 0.45)',
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
  const [appVersion, setAppVersion] = useState<string>('')
  const { colorScheme, setColorScheme } = useSettings()
  const [isTransfersOpen, setIsTransfersOpen] = useState(false)
  const [transfersTab, setTransfersTab] = useState<'downloads' | 'uploads'>(() => {
    try {
      const v = localStorage.getItem('vrcyberdeck:transfersTab')
      return v === 'uploads' ? 'uploads' : 'downloads'
    } catch {
      return 'downloads'
    }
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCreditsOpen, setIsCreditsOpen] = useState(false)
  const [isDarkModeJokeOpen, setIsDarkModeJokeOpen] = useState(false)
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false)
  const mountNodeRef = useRef<HTMLDivElement>(null)
  const styles = useStyles()
  const { queue: downloadQueue } = useDownload()
  const { queue: uploadQueue } = useUpload()
  const { t } = useLanguage()

  useEffect(() => {
    window.api.app.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  const hasActiveTransfers = useMemo(() => {
    const activeDownload = downloadQueue.some((i) =>
      ['Queued', 'Downloading', 'Extracting', 'Installing'].includes(i.status)
    )
    const activeUpload = uploadQueue.some((i) =>
      ['Queued', 'Preparing', 'Uploading'].includes(i.status)
    )
    return activeDownload || activeUpload
  }, [downloadQueue, uploadQueue])

  // Keep a ref so the close-requested listener always sees the latest value
  // without needing to resubscribe (which would race with main-process events).
  const hasActiveTransfersRef = useRef(hasActiveTransfers)
  useEffect(() => {
    hasActiveTransfersRef.current = hasActiveTransfers
  }, [hasActiveTransfers])

  useEffect(() => {
    return window.api.app.onCloseRequested(() => {
      if (hasActiveTransfersRef.current) {
        setIsCloseConfirmOpen(true)
      } else {
        window.api.app.confirmClose()
      }
    })
  }, [])

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
                      <span className={styles.titleMain}>
                        <span className={styles.titleVR}>VR</span>
                        <span className={styles.titleCyberdeck}>
                          <span className="title-glitch-wrap" data-text="CYBERDECK">CYBERDECK</span>
                        </span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={styles.titleSub}>OPERATE. DEPLOY. CONTROL.</span>
                        {appVersion && (
                          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(var(--vrcd-purple-raw),0.6)', letterSpacing: '0.1em' }}>
                            v{appVersion}
                          </span>
                        )}
                      </div>
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
                    <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.12em', color: 'rgba(var(--vrcd-neon-raw), 0.6)', textTransform: 'uppercase' }}>Dark Mode</span>
                    <div style={{ '--colorBrandBackground': 'var(--vrcd-neon)', '--colorBrandBackgroundHover': 'rgba(var(--vrcd-neon-raw),0.8)', '--colorBrandBackgroundPressed': 'rgba(var(--vrcd-neon-raw),0.6)', '--colorCompoundBrandBackground': 'var(--vrcd-neon)', '--colorCompoundBrandBackgroundHover': 'rgba(var(--vrcd-neon-raw),0.8)', pointerEvents: 'none' } as React.CSSProperties}>
                      <Switch checked={true} readOnly />
                    </div>
                  </div>
                </div>

              </div>

              {/* Dark mode joke dialog — custom overlay for guaranteed viewport centering */}
              {isDarkModeJokeOpen && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(2px)'
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setIsDarkModeJokeOpen(false)
                  }}
                >
                  <div
                    style={{
                      background: '#030310',
                      border: '1px solid rgba(var(--vrcd-neon-raw),0.45)',
                      maxWidth: '480px',
                      width: '90vw',
                      fontFamily: 'monospace',
                      borderRadius: '8px',
                      padding: '24px 28px 28px',
                      boxShadow: '0 0 50px rgba(var(--vrcd-neon-raw),0.08), 0 0 80px rgba(var(--vrcd-purple-raw),0.06)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
                      {/* Neon crying-laughing face */}
                      <svg width="200" height="200" viewBox="0 0 200 200" style={{ overflow: 'visible', filter: 'drop-shadow(0 0 14px var(--vrcd-neon)) drop-shadow(0 0 40px rgba(var(--vrcd-neon-raw),0.55)) drop-shadow(0 0 70px rgba(var(--vrcd-neon-raw),0.2))' }}>
                        <defs>
                          <filter id="jk-g" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="4" result="b"/>
                            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                          </filter>
                          <filter id="jk-pg" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="5" result="b"/>
                            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                          </filter>
                        </defs>
                        <circle cx="100" cy="100" r="88" fill="#010108"/>
                        <circle cx="100" cy="100" r="88" fill="none" stroke="var(--vrcd-neon)" strokeWidth="5" filter="url(#jk-g)"/>
                        <path d="M 58,80 Q 72,68 86,80" fill="none" stroke="var(--vrcd-neon)" strokeWidth="4" strokeLinecap="round" filter="url(#jk-g)"/>
                        <path d="M 114,80 Q 128,68 142,80" fill="none" stroke="var(--vrcd-neon)" strokeWidth="4" strokeLinecap="round" filter="url(#jk-g)"/>
                        <path d="M 52,124 Q 100,175 148,124" fill="none" stroke="var(--vrcd-neon)" strokeWidth="4.5" strokeLinecap="round" filter="url(#jk-g)"/>
                        <path d="M 64,87 Q 52,108 58,128" fill="none" stroke="var(--vrcd-purple)" strokeWidth="3.5" strokeLinecap="round" filter="url(#jk-pg)"/>
                        <ellipse cx="57" cy="132" rx="5.5" ry="8" fill="var(--vrcd-purple)" filter="url(#jk-pg)"/>
                        <path d="M 136,87 Q 148,108 142,128" fill="none" stroke="var(--vrcd-purple)" strokeWidth="3.5" strokeLinecap="round" filter="url(#jk-pg)"/>
                        <ellipse cx="143" cy="132" rx="5.5" ry="8" fill="var(--vrcd-purple)" filter="url(#jk-pg)"/>
                      </svg>

                      <div style={{ fontSize: '52px', color: 'var(--vrcd-neon)', letterSpacing: '0.2em', fontWeight: 900, fontFamily: '"Courier New", monospace', textShadow: '0 0 10px var(--vrcd-neon), 0 0 30px rgba(var(--vrcd-neon-raw),0.7), 0 0 60px rgba(var(--vrcd-neon-raw),0.3)', lineHeight: 1 }}>LMAO</div>

                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(var(--vrcd-purple-raw),0.6)', boxShadow: '0 0 6px rgba(var(--vrcd-purple-raw),0.4)' }}/>
                        <span style={{ color: 'var(--vrcd-purple)', fontSize: '12px', margin: '0 10px', textShadow: '0 0 8px rgba(var(--vrcd-purple-raw),0.9)', filter: 'drop-shadow(0 0 4px var(--vrcd-purple))' }}>◆</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(var(--vrcd-purple-raw),0.6)', boxShadow: '0 0 6px rgba(var(--vrcd-purple-raw),0.4)' }}/>
                      </div>

                      <div style={{ fontSize: '15px', color: 'var(--vrcd-neon)', lineHeight: 2, fontFamily: '"Courier New", monospace', textShadow: '0 0 6px rgba(var(--vrcd-neon-raw),0.35)' }}>
                        This is just for looks.<br />
                        Do people actually USE<br />
                        light mode?
                      </div>

                      <button
                        onClick={() => setIsDarkModeJokeOpen(false)}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: '2px solid rgba(var(--vrcd-neon-raw),0.65)',
                          color: 'var(--vrcd-neon)',
                          fontFamily: '"Courier New", monospace',
                          fontSize: '14px',
                          letterSpacing: '0.1em',
                          padding: '12px 0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontStyle: 'italic',
                          boxShadow: '0 0 14px rgba(var(--vrcd-neon-raw),0.15), inset 0 0 14px rgba(var(--vrcd-neon-raw),0.04)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        [ *Cries in binary ]
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                style={{ width: '700px', background: '#050514', borderLeft: '1px solid rgba(var(--vrcd-neon-raw),0.25)', ['--colorNeutralBackground1' as string]: '#050514', ['--colorNeutralForeground1' as string]: 'var(--vrcd-neon)', ['--colorNeutralForeground2' as string]: 'rgba(var(--vrcd-neon-raw),0.75)', ['--colorNeutralStroke1' as string]: 'rgba(var(--vrcd-neon-raw),0.2)', ['--colorBrandBackground' as string]: 'var(--vrcd-neon)', ['--colorNeutralForegroundOnBrand' as string]: '#050514' } as React.CSSProperties}
                mountNode={mountNodeRef.current}
              >
                <DrawerHeader style={{ background: '#050514', borderBottom: '1px solid rgba(var(--vrcd-neon-raw),0.15)', padding: '12px 20px' }}>
                  <DrawerHeaderTitle
                    action={
                      <Button
                        appearance="subtle"
                        aria-label={t('close')}
                        icon={<CloseIcon />}
                        onClick={() => setIsTransfersOpen(false)}
                        style={{ color: 'var(--vrcd-neon)' }}
                      />
                    }
                    style={{ color: 'var(--vrcd-neon)', fontFamily: 'monospace', letterSpacing: '0.08em' }}
                  >
                    Transfers
                  </DrawerHeaderTitle>
                </DrawerHeader>
                <DrawerBody style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, background: '#050514' }}>
                  <TabList
                    selectedValue={transfersTab}
                    onTabSelect={(_, d) => {
                      const tab = d.value as 'downloads' | 'uploads'
                      setTransfersTab(tab)
                      try { localStorage.setItem('vrcyberdeck:transfersTab', tab) } catch { /* ignore */ }
                    }}
                    style={{ padding: '0 16px', borderBottom: '1px solid rgba(var(--vrcd-neon-raw),0.15)', flexShrink: 0 }}
                  >
                    <Tab value="downloads" icon={<DownloadIcon />}>{t('downloads')}</Tab>
                    <Tab value="uploads" icon={<UploadIcon />}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {t('uploads')}
                        {uploadQueue.filter((i) => i.status === 'Queued' || i.status === 'Preparing' || i.status === 'Uploading').length > 0 && (
                          <CounterBadge
                            count={uploadQueue.filter((i) => i.status === 'Queued' || i.status === 'Preparing' || i.status === 'Uploading').length}
                            size="small"
                            color="brand"
                          />
                        )}
                      </span>
                    </Tab>
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

              {/* Close confirmation when transfers are still in progress */}
              {isCloseConfirmOpen && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.78)',
                    backdropFilter: 'blur(2px)'
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setIsCloseConfirmOpen(false)
                  }}
                >
                  <div
                    style={{
                      background: '#030310',
                      border: '1px solid rgba(var(--vrcd-neon-raw),0.45)',
                      maxWidth: '520px',
                      width: '90vw',
                      fontFamily: '"Courier New", monospace',
                      borderRadius: '8px',
                      padding: '28px 32px',
                      boxShadow:
                        '0 0 50px rgba(var(--vrcd-neon-raw),0.10), 0 0 80px rgba(var(--vrcd-purple-raw),0.08)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '20px',
                        color: 'var(--vrcd-purple)',
                        letterSpacing: '0.1em',
                        fontWeight: 700,
                        textAlign: 'center',
                        textShadow:
                          '0 0 10px rgba(var(--vrcd-purple-raw),0.7), 0 0 24px rgba(var(--vrcd-purple-raw),0.3)',
                        marginBottom: '14px',
                        textTransform: 'uppercase'
                      }}
                    >
                      [ TRANSFERS IN PROGRESS ]
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: 'var(--vrcd-neon)',
                        lineHeight: 1.7,
                        textAlign: 'center',
                        textShadow: '0 0 6px rgba(var(--vrcd-neon-raw),0.35)',
                        marginBottom: '24px'
                      }}
                    >
                      Are you sure you want to leave the CyberDeck?
                      <br />
                      Transfers are still happening. Leaving will stop these
                      <br />
                      and make you restart them.
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => setIsCloseConfirmOpen(false)}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: '2px solid rgba(var(--vrcd-neon-raw),0.65)',
                          color: 'var(--vrcd-neon)',
                          fontFamily: '"Courier New", monospace',
                          fontSize: '13px',
                          letterSpacing: '0.1em',
                          padding: '12px 0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          boxShadow:
                            '0 0 14px rgba(var(--vrcd-neon-raw),0.15), inset 0 0 14px rgba(var(--vrcd-neon-raw),0.04)'
                        }}
                      >
                        Stay Jacked In
                      </button>
                      <button
                        onClick={() => {
                          setIsCloseConfirmOpen(false)
                          window.api.app.confirmClose()
                        }}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: '2px solid rgba(var(--vrcd-purple-raw),0.7)',
                          color: 'var(--vrcd-purple)',
                          fontFamily: '"Courier New", monospace',
                          fontSize: '13px',
                          letterSpacing: '0.1em',
                          padding: '12px 0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          boxShadow:
                            '0 0 14px rgba(var(--vrcd-purple-raw),0.18), inset 0 0 14px rgba(var(--vrcd-purple-raw),0.05)'
                        }}
                      >
                        Leave Anyway
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                      border: '1px solid rgba(var(--vrcd-neon-raw),0.25)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: '0 0 40px rgba(var(--vrcd-neon-raw),0.06)'
                    }}
                  >
                    <Button
                      appearance="subtle"
                      icon={<CloseIcon />}
                      aria-label={t('close')}
                      onClick={() => setIsSettingsOpen(false)}
                      style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, color: 'var(--vrcd-neon)' }}
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
