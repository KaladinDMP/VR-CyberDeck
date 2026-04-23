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
    lineHeight: '1.1',
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px'
  },
  titleVR: {
    color: '#a855f7',
    textShadow: '0 0 18px rgba(168,85,247,0.9), 0 0 40px rgba(168,85,247,0.4)',
    fontFamily: '"Courier New", monospace'
  },
  titleCyberdeck: {
    color: '#39ff14',
    textShadow: '0 0 18px rgba(57,255,20,0.8), 0 0 40px rgba(57,255,20,0.3)',
    fontFamily: '"Courier New", monospace',
    letterSpacing: '0.08em'
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
                      <span className={styles.titleMain}>
                        <span className={styles.titleVR}>VR</span>
                        <span className={styles.titleCyberdeck}>
                          <span className="title-glitch-wrap" data-text="CYBERDECK">CYBERDECK</span>
                        </span>
                      </span>
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
                  <DialogSurface style={{ background: '#030310', border: '1px solid rgba(57,255,20,0.45)', maxWidth: '480px', width: '90vw', fontFamily: 'monospace', boxShadow: '0 0 50px rgba(57,255,20,0.08), 0 0 80px rgba(168,85,247,0.06)' }}>
                    <DialogBody style={{ padding: '24px 28px 28px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>

                        {/* Neon crying-laughing face */}
                        <svg width="200" height="200" viewBox="0 0 200 200" style={{ overflow: 'visible', filter: 'drop-shadow(0 0 14px #39ff14) drop-shadow(0 0 40px rgba(57,255,20,0.55)) drop-shadow(0 0 70px rgba(57,255,20,0.2))' }}>
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
                          {/* Face: dark fill + thick glowing ring */}
                          <circle cx="100" cy="100" r="88" fill="#010108"/>
                          <circle cx="100" cy="100" r="88" fill="none" stroke="#39ff14" strokeWidth="5" filter="url(#jk-g)"/>
                          {/* Left squinting eye */}
                          <path d="M 58,80 Q 72,68 86,80" fill="none" stroke="#39ff14" strokeWidth="4" strokeLinecap="round" filter="url(#jk-g)"/>
                          {/* Right squinting eye */}
                          <path d="M 114,80 Q 128,68 142,80" fill="none" stroke="#39ff14" strokeWidth="4" strokeLinecap="round" filter="url(#jk-g)"/>
                          {/* Wide smile */}
                          <path d="M 52,124 Q 100,175 148,124" fill="none" stroke="#39ff14" strokeWidth="4.5" strokeLinecap="round" filter="url(#jk-g)"/>
                          {/* Left tear */}
                          <path d="M 64,87 Q 52,108 58,128" fill="none" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="round" filter="url(#jk-pg)"/>
                          <ellipse cx="57" cy="132" rx="5.5" ry="8" fill="#a855f7" filter="url(#jk-pg)"/>
                          {/* Right tear */}
                          <path d="M 136,87 Q 148,108 142,128" fill="none" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="round" filter="url(#jk-pg)"/>
                          <ellipse cx="143" cy="132" rx="5.5" ry="8" fill="#a855f7" filter="url(#jk-pg)"/>
                        </svg>

                        {/* LMAO */}
                        <div style={{ fontSize: '52px', color: '#39ff14', letterSpacing: '0.2em', fontWeight: 900, fontFamily: '"Courier New", monospace', textShadow: '0 0 10px #39ff14, 0 0 30px rgba(57,255,20,0.7), 0 0 60px rgba(57,255,20,0.3)', lineHeight: 1 }}>LMAO</div>

                        {/* Purple divider */}
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(168,85,247,0.6)', boxShadow: '0 0 6px rgba(168,85,247,0.4)' }}/>
                          <span style={{ color: '#a855f7', fontSize: '12px', margin: '0 10px', textShadow: '0 0 8px rgba(168,85,247,0.9)', filter: 'drop-shadow(0 0 4px #a855f7)' }}>◆</span>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(168,85,247,0.6)', boxShadow: '0 0 6px rgba(168,85,247,0.4)' }}/>
                        </div>

                        {/* Body text — 3 centred lines */}
                        <div style={{ fontSize: '15px', color: '#39ff14', lineHeight: 2, fontFamily: '"Courier New", monospace', textShadow: '0 0 6px rgba(57,255,20,0.35)' }}>
                          This is just for looks.<br />
                          Do people actually USE<br />
                          light mode?
                        </div>

                        {/* Single-line full-width button */}
                        <button
                          onClick={() => setIsDarkModeJokeOpen(false)}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: '2px solid rgba(57,255,20,0.65)',
                            color: '#39ff14',
                            fontFamily: '"Courier New", monospace',
                            fontSize: '14px',
                            letterSpacing: '0.1em',
                            padding: '12px 0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontStyle: 'italic',
                            boxShadow: '0 0 14px rgba(57,255,20,0.15), inset 0 0 14px rgba(57,255,20,0.04)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          [ *Cries in binary ]
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
                style={{ width: '700px', background: '#050514', borderLeft: '1px solid rgba(57,255,20,0.25)', ['--colorNeutralBackground1' as string]: '#050514', ['--colorNeutralForeground1' as string]: '#39ff14', ['--colorNeutralForeground2' as string]: 'rgba(57,255,20,0.75)', ['--colorNeutralStroke1' as string]: 'rgba(57,255,20,0.2)', ['--colorBrandBackground' as string]: '#39ff14', ['--colorNeutralForegroundOnBrand' as string]: '#050514' } as React.CSSProperties}
                mountNode={mountNodeRef.current}
              >
                <DrawerHeader style={{ background: '#050514', borderBottom: '1px solid rgba(57,255,20,0.15)', padding: '12px 20px' }}>
                  <DrawerHeaderTitle
                    action={
                      <Button
                        appearance="subtle"
                        aria-label={t('close')}
                        icon={<CloseIcon />}
                        onClick={() => setIsTransfersOpen(false)}
                        style={{ color: '#39ff14' }}
                      />
                    }
                    style={{ color: '#39ff14', fontFamily: 'monospace', letterSpacing: '0.08em' }}
                  >
                    Transfers
                  </DrawerHeaderTitle>
                </DrawerHeader>
                <DrawerBody style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, background: '#050514' }}>
                  <TabList
                    selectedValue={transfersTab}
                    onTabSelect={(_, d) => setTransfersTab(d.value as 'downloads' | 'uploads')}
                    style={{ padding: '0 16px', borderBottom: '1px solid rgba(57,255,20,0.15)', flexShrink: 0 }}
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
