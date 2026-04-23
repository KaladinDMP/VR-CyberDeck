import React, { useState, useEffect, useRef, useCallback } from 'react'
import CreditsDialog from './CreditsDialog'
import '../assets/credits-dialog.css'
import {
  Card,
  CardHeader,
  Text,
  Button,
  Input,
  makeStyles,
  tokens,
  Spinner,
  Switch,
  Title2,
  Subtitle1,
  Dropdown,
  Option,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  TableCellLayout
} from '@fluentui/react-components'
import {
  FolderOpenRegular,
  CheckmarkCircleRegular,
  InfoRegular,
  DeleteRegular,
  ShareRegular,
  DocumentTextRegular,
  CopyRegular,
  EditRegular,
  ChevronDownRegular,
  ChevronUpRegular
} from '@fluentui/react-icons'
import { useSettings } from '../hooks/useSettings'
import { useGames } from '../hooks/useGames'
import { useLogs } from '../hooks/useLogs'
import { useLanguage } from '../hooks/useLanguage'
import { useAdb } from '../hooks/useAdb'

// Supported speed units with conversion factors to KB/s
const SPEED_UNITS = [
  { label: 'KB/s', value: 'kbps', factor: 1 },
  { label: 'MB/s', value: 'mbps', factor: 1024 }
]

const neonBtn = {
  background: 'transparent',
  border: '1px solid rgba(57,255,20,0.5)',
  color: '#39ff14',
  fontFamily: '"Courier New", monospace',
  fontSize: '11px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  padding: '8px 20px',
  borderRadius: '4px',
  cursor: 'pointer',
  boxShadow: '0 0 8px rgba(57,255,20,0.12)'
}

const neonInput = {
  background: 'rgba(57,255,20,0.04)',
  border: '1px solid rgba(57,255,20,0.3)',
  color: '#39ff14',
  fontFamily: '"Courier New", monospace',
  fontSize: '12px'
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    position: 'relative',
    width: '100%',
    height: 'calc(92vh - 48px)',
    overflowY: 'auto',
    padding: '24px 32px',
    backgroundColor: '#050514',
    boxSizing: 'border-box'
  },
  contentContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL
  },
  headerTitle: {
    marginBottom: tokens.spacingVerticalXS,
    color: '#39ff14',
    fontFamily: '"Courier New", monospace',
    letterSpacing: '0.04em'
  },
  headerSubtitle: {
    color: 'rgba(57,255,20,0.55)',
    display: 'block',
    marginBottom: tokens.spacingVerticalL,
    fontFamily: 'monospace',
    fontSize: '12px'
  },
  card: {
    width: '100%',
    background: 'rgba(57,255,20,0.03)',
    border: '1px solid rgba(57,255,20,0.18)',
    borderRadius: '6px',
    boxShadow: 'none'
  },
  cardContent: {
    padding: tokens.spacingHorizontalL,
    paddingBottom: tokens.spacingVerticalXL
  },
  formRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: tokens.spacingVerticalM,
    gap: tokens.spacingHorizontalM,
    width: '100%',
    maxWidth: '900px'
  },
  input: {
    flexGrow: 1
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    marginTop: tokens.spacingVerticalXS
  },
  success: {
    color: tokens.colorPaletteGreenForeground1,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXS
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2
  },
  speedLimitSection: {
    marginTop: tokens.spacingVerticalL
  },
  speedFormRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
    width: '100%',
    maxWidth: '900px'
  },
  speedControl: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS
  },
  speedInputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS
  },
  speedInput: {
    width: '140px',
    flexGrow: 1
  },
  unitDropdown: {
    width: '80px',
    minWidth: '80px'
  },
  blacklistTable: {
    marginTop: tokens.spacingVerticalM,
    width: '100%',
    maxWidth: '900px'
  },
  emptyState: {
    marginTop: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
    padding: tokens.spacingVerticalL
  },
  actionButton: {
    minWidth: 'auto'
  }
})

const BlacklistSettings: React.FC = () => {
  const styles = useStyles()
  const { t } = useLanguage()
  const { getBlacklistGames, removeGameFromBlacklist } = useGames()
  const [blacklistGames, setBlacklistGames] = useState<
    { packageName: string; version: number | 'any' }[]
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removeSuccess, setRemoveSuccess] = useState(false)

  const loadBlacklistGames = async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)
      const games = await getBlacklistGames()
      setBlacklistGames(games)
    } catch (err) {
      console.error('Error loading blacklisted games:', err)
      setError('Failed to load blacklisted games')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBlacklistGames()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRemoveFromBlacklist = async (packageName: string): Promise<void> => {
    try {
      setError(null)
      await removeGameFromBlacklist(packageName)
      await loadBlacklistGames()
      setRemoveSuccess(true)
      setTimeout(() => setRemoveSuccess(false), 3000)
    } catch (err) {
      console.error('Error removing game from blacklist:', err)
      setError(t('blacklistRemoveError'))
    }
  }

  return (
    <Card className={styles.card}>
      <CardHeader description={<Subtitle1 weight="semibold">{t('blacklistedGames')}</Subtitle1>} />
      <div className={styles.cardContent}>
        <Text>{t('blacklistedGamesDesc')}</Text>

        {isLoading ? (
          <div
            style={{ display: 'flex', justifyContent: 'center', padding: tokens.spacingVerticalL }}
          >
            <Spinner size="small" label={t('loadingBlacklist')} />
          </div>
        ) : (
          <>
            {blacklistGames.length === 0 ? (
              <div className={styles.emptyState}>
                <Text>{t('noBlacklistedGames')}</Text>
              </div>
            ) : (
              <Table className={styles.blacklistTable}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>{t('packageName')}</TableHeaderCell>
                    <TableHeaderCell>{t('version')}</TableHeaderCell>
                    <TableHeaderCell style={{ width: '100px' }}>{t('actions')}</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blacklistGames.map((game) => (
                    <TableRow key={`${game.packageName}-${game.version}`}>
                      <TableCell>
                        <TableCellLayout>{game.packageName}</TableCellLayout>
                      </TableCell>
                      <TableCell>
                        <TableCellLayout>
                          {game.version === 'any' ? t('allVersions') : game.version}
                        </TableCellLayout>
                      </TableCell>
                      <TableCell>
                        <Button
                          icon={<DeleteRegular />}
                          appearance="subtle"
                          className={styles.actionButton}
                          onClick={() => handleRemoveFromBlacklist(game.packageName)}
                          aria-label={t('remove')}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {error && <Text className={styles.error}>{error}</Text>}
            {removeSuccess && (
              <Text className={styles.success}>
                <CheckmarkCircleRegular />
                {t('blacklistRemoveSuccess')}
              </Text>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

const LogUploadSettings: React.FC = () => {
  const styles = useStyles()
  const { t } = useLanguage()
  const {
    isUploading,
    uploadError,
    uploadSuccess,
    shareableUrl,
    slug,
    uploadCurrentLog,
    clearUploadState,
    openLogFolder,
    openLogFile
  } = useLogs()

  const handleUploadLog = async (): Promise<void> => {
    clearUploadState()
    await uploadCurrentLog()
  }

  const handleCopySlug = (): void => {
    if (slug) navigator.clipboard.writeText(slug)
  }

  const handleCopyUrl = (): void => {
    if (shareableUrl) navigator.clipboard.writeText(shareableUrl)
  }

  return (
    <Card className={styles.card}>
      <CardHeader description={<Subtitle1 weight="semibold">{t('logUpload')}</Subtitle1>} />
      <div className={styles.cardContent}>
        <Text>{t('logUploadDesc')}</Text>

        <div className={styles.formRow} style={{ gap: tokens.spacingHorizontalS, flexWrap: 'wrap' }}>
          <Button
            onClick={() => openLogFolder()}
            appearance="secondary"
            size="medium"
            icon={<FolderOpenRegular />}
          >
            {t('openLogFolder')}
          </Button>
          <Button
            onClick={() => openLogFile()}
            appearance="secondary"
            size="medium"
            icon={<DocumentTextRegular />}
          >
            {t('openLogFile')}
          </Button>
          <Button
            onClick={handleUploadLog}
            appearance="primary"
            size="medium"
            disabled={isUploading}
            icon={<ShareRegular />}
          >
            {isUploading ? t('uploading_log') : t('uploadCurrentLog')}
          </Button>
        </div>

        {uploadError && <Text className={styles.error}>{uploadError}</Text>}

        {uploadSuccess && shareableUrl && (
          <div className={styles.success}>
            <CheckmarkCircleRegular />
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS }}>
              <Text>{t('logUploadSuccess')}</Text>

              {/* Rentry share code — prominently displayed, auto-copied on upload */}
              {slug && (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS }}
                >
                  <Text weight="semibold">{t('rentryCode')}</Text>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}
                  >
                    <Input
                      value={slug}
                      readOnly
                      style={{
                        width: '220px',
                        fontFamily: 'monospace',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    />
                    <Button onClick={handleCopySlug} size="small" appearance="primary" icon={<CopyRegular />}>
                      {t('copyCode')}
                    </Button>
                  </div>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {t('rentryCodeHint')}
                  </Text>
                </div>
              )}

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS }}
              >
                <Text weight="semibold">{t('url')}</Text>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}
                >
                  <Input
                    value={shareableUrl}
                    readOnly
                    style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '12px' }}
                  />
                  <Button onClick={handleCopyUrl} size="small" appearance="secondary" icon={<CopyRegular />}>
                    {t('copyUrl')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Text className={styles.hint}>
          <InfoRegular />
          {t('logUploadHint')}
        </Text>
      </div>
    </Card>
  )
}

const INTRO_STORAGE_KEY = 'vrcyberdeck:showIntro'

const IntroSettings: React.FC = () => {
  const styles = useStyles()
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(INTRO_STORAGE_KEY)
      return stored === null || stored === 'true'
    } catch {
      return true
    }
  })

  const handleToggle = useCallback((_ev: unknown, data: { checked: boolean }): void => {
    setShowIntro(data.checked)
    try {
      localStorage.setItem(INTRO_STORAGE_KEY, String(data.checked))
    } catch {
      // ignore
    }
  }, [])

  return (
    <div style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ '--colorBrandBackground': '#39ff14', '--colorBrandBackgroundHover': 'rgba(57,255,20,0.8)', '--colorBrandBackgroundPressed': 'rgba(57,255,20,0.6)', '--colorCompoundBrandBackground': '#39ff14', '--colorCompoundBrandBackgroundHover': 'rgba(57,255,20,0.8)' } as React.CSSProperties}>
          <Switch checked={showIntro} onChange={handleToggle} />
        </div>
        <span style={{ color: '#39ff14', fontFamily: 'monospace', fontSize: '12px' }}>Show intro animation on launch</span>
      </div>
      <span style={{ color: 'rgba(57,255,20,0.45)', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.5 }}>
        Hacker-console boot sequence shown each time the app opens. Takes ~10 seconds.
      </span>
    </div>
  )
}

const MpUsernameSettings: React.FC = () => {
  const styles = useStyles()
  const { userName, loadingUserName, setUserName, isConnected } = useAdb()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [saved, setSaved] = useState(false)

  const handleEdit = (): void => {
    setEditValue(userName)
    setIsEditing(true)
  }

  const handleSave = async (): Promise<void> => {
    if (!editValue.trim()) return
    try {
      await setUserName(editValue.trim())
      setIsEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error('Failed to set username:', e)
    }
  }

  return (
    <Card className={styles.card}>
      <CardHeader description={<Subtitle1 weight="semibold">Multiplayer Username</Subtitle1>} />
      <div className={styles.cardContent}>
        <Text>Your display name in VR multiplayer games.</Text>
        {!isConnected && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: tokens.spacingVerticalXS }}>
            Connect a device to change your username.
          </Text>
        )}
        <div className={styles.formRow}>
          {isEditing ? (
            <>
              <Input
                className={styles.input}
                value={editValue}
                onChange={(_, data) => setEditValue(data.value)}
                placeholder="Enter VR display name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') setIsEditing(false)
                }}
              />
              <Button appearance="primary" size="medium" onClick={handleSave} disabled={loadingUserName || !editValue.trim()}>
                {loadingUserName ? <Spinner size="tiny" /> : 'Save'}
              </Button>
              <Button appearance="subtle" size="medium" onClick={() => setIsEditing(false)} disabled={loadingUserName}>Cancel</Button>
            </>
          ) : (
            <Button appearance="outline" size="medium" icon={<EditRegular />} onClick={handleEdit} disabled={!isConnected}>
              {userName || 'Click to set username'}
            </Button>
          )}
        </div>
        {saved && (
          <Text className={styles.success}>
            <CheckmarkCircleRegular />
            Username saved!
          </Text>
        )}
      </div>
    </Card>
  )
}

interface SectionHeaderProps {
  label: string
  sectionKey: string
  openSections: Record<string, boolean>
  onToggle: (key: string) => void
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ label, sectionKey, openSections, onToggle }) => (
  <button
    onClick={() => onToggle(sectionKey)}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'transparent', border: 'none', borderBottom: '1px solid rgba(57,255,20,0.15)',
      padding: '8px 4px', cursor: 'pointer', color: 'rgba(57,255,20,0.8)',
      fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase',
      marginBottom: openSections[sectionKey] ? '8px' : '0'
    }}
  >
    <span>{label}</span>
    {openSections[sectionKey] ? <ChevronUpRegular style={{ fontSize: '14px' }} /> : <ChevronDownRegular style={{ fontSize: '14px' }} />}
  </button>
)

// ─── Matrix Identity Settings ─────────────────────────────────────────────────
const USERNAME_PREFS_KEY = 'vr-matrix-usernames'
interface UsernamePref { mode: 'random+custom' | 'only-custom'; ratio: number; custom: string[] }

const MatrixIdentitySettings: React.FC = () => {
  const [prefs, setPrefsState] = useState<UsernamePref>(() => {
    try {
      const raw = localStorage.getItem(USERNAME_PREFS_KEY)
      if (raw) return { mode: 'random+custom', ratio: 2, custom: [], ...JSON.parse(raw) }
    } catch { /* ignore */ }
    return { mode: 'random+custom', ratio: 2, custom: [] }
  })
  const [newEntry, setNewEntry] = useState('')

  const save = (next: UsernamePref): void => {
    try { localStorage.setItem(USERNAME_PREFS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    setPrefsState(next)
  }

  const addEntry = (): void => {
    const v = newEntry.trim()
    if (!v || prefs.custom.includes(v)) return
    save({ ...prefs, custom: [...prefs.custom, v] })
    setNewEntry('')
  }

  const removeEntry = (name: string): void =>
    save({ ...prefs, custom: prefs.custom.filter((c) => c !== name) })

  const S = { fontFamily: 'monospace', fontSize: '12px' } as const
  const inputStyle: React.CSSProperties = { background: 'rgba(57,255,20,0.04)', border: '1px solid rgba(57,255,20,0.3)', color: '#39ff14', fontFamily: 'monospace', fontSize: '12px', padding: '4px 8px', borderRadius: '4px', outline: 'none' }

  const RATIO_OPTIONS = [
    { label: '1:1 — no preference', value: 1 },
    { label: '1.1:1 — slight preference', value: 1.1 },
    { label: '2:1 — default preference (recommended)', value: 2 },
    { label: '3:1 — strong preference', value: 3 },
    { label: '5:1 — almost always custom', value: 5 }
  ]

  return (
    <div style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <span style={{ ...S, color: 'rgba(57,255,20,0.5)', lineHeight: 1.6 }}>
        Controls which username appears in the ADB Shell Matrix intro animation.{'\n'}
        Edit <span style={{ color: '#39ff14' }}>g33kyu$3rn4m3$.json</span> in the app resources to customise the random pool.
      </span>

      {/* Mode toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ ...S, color: 'rgba(57,255,20,0.7)' }}>Username source</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['random+custom', 'only-custom'] as const).map((m) => (
            <button key={m} onClick={() => save({ ...prefs, mode: m })}
              style={{ ...inputStyle, cursor: 'pointer', background: prefs.mode === m ? 'rgba(57,255,20,0.12)' : 'transparent', borderColor: prefs.mode === m ? '#39ff14' : 'rgba(57,255,20,0.3)', color: prefs.mode === m ? '#39ff14' : 'rgba(57,255,20,0.5)' }}>
              {m === 'random+custom' ? 'Random + Custom' : 'Custom Only'}
            </button>
          ))}
        </div>
      </div>

      {/* Ratio (only shown in random+custom mode when custom list has entries) */}
      {prefs.mode === 'random+custom' && prefs.custom.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ ...S, color: 'rgba(57,255,20,0.7)' }}>Custom preference ratio</span>
          <select value={prefs.ratio} onChange={(e) => save({ ...prefs, ratio: Number(e.target.value) })}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            {RATIO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ background: '#050514', color: '#39ff14' }}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Custom entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ ...S, color: 'rgba(57,255,20,0.7)' }}>Custom usernames</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input value={newEntry} onChange={(e) => setNewEntry(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="add username..." style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addEntry} style={{ ...inputStyle, cursor: 'pointer', padding: '4px 12px' }}>+</button>
        </div>
        {prefs.custom.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            {prefs.custom.map((name) => (
              <span key={name} style={{ ...S, background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.25)', color: '#39ff14', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {name}
                <button onClick={() => removeEntry(name)} style={{ background: 'none', border: 'none', color: 'rgba(168,85,247,0.8)', cursor: 'pointer', fontSize: '11px', padding: 0, lineHeight: 1 }}>✕</button>
              </span>
            ))}
          </div>
        )}
        {prefs.custom.length === 0 && (
          <span style={{ ...S, color: 'rgba(57,255,20,0.3)', fontStyle: 'italic' }}>no custom usernames yet</span>
        )}
      </div>
    </div>
  )
}

const Settings: React.FC = () => {
  const styles = useStyles()
  const {
    downloadPath,
    downloadSpeedLimit,
    uploadSpeedLimit,
    isLoading,
    error,
    setDownloadPath,
    setDownloadSpeedLimit,
    setUploadSpeedLimit
  } = useSettings()
  const [editedDownloadPath, setEditedDownloadPath] = useState(downloadPath)
  const [isCreditsOpen, setIsCreditsOpen] = useState(false)
  const [hideAdultContent, setHideAdultContentLocal] = useState<boolean>(() => {
    try { return localStorage.getItem('vrcyberdeck:hideAdult') !== 'false' } catch { return true }
  })
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    intro: true,
    username: false,
    logs: false,
    download: false,
    blacklist: false,
    content: false,
    matrixId: false
  })
  const toggleSection = useCallback((key: string): void =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  , [])

  // New state for speed input values
  const [downloadSpeedInput, setDownloadSpeedInput] = useState(
    downloadSpeedLimit > 0 ? String(downloadSpeedLimit) : ''
  )
  const [uploadSpeedInput, setUploadSpeedInput] = useState(
    uploadSpeedLimit > 0 ? String(uploadSpeedLimit) : ''
  )
  const [downloadSpeedUnit, setDownloadSpeedUnit] = useState(SPEED_UNITS[0].value)
  const [uploadSpeedUnit, setUploadSpeedUnit] = useState(SPEED_UNITS[0].value)

  // Add refs to store original values in KB/s
  const originalDownloadKbps = useRef<number | null>(null)
  const originalUploadKbps = useRef<number | null>(null)

  const [localError, setLocalError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')

  useEffect(() => {
    let mounted = true
    const p = window.api.app?.getVersion?.()
    if (p) p.then((v) => { if (mounted) setAppVersion(v) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  // Update local state when the context values change
  useEffect(() => {
    setEditedDownloadPath(downloadPath)

    // Handle new download/upload speed state
    if (downloadSpeedLimit === 0) {
      setDownloadSpeedInput('')
      originalDownloadKbps.current = null
    } else {
      setDownloadSpeedInput(String(downloadSpeedLimit))
      setDownloadSpeedUnit('kbps') // Always reset to KB/s when loading from settings
      originalDownloadKbps.current = downloadSpeedLimit
    }

    if (uploadSpeedLimit === 0) {
      setUploadSpeedInput('')
      originalUploadKbps.current = null
    } else {
      setUploadSpeedInput(String(uploadSpeedLimit))
      setUploadSpeedUnit('kbps') // Always reset to KB/s when loading from settings
      originalUploadKbps.current = uploadSpeedLimit
    }
  }, [downloadPath, downloadSpeedLimit, uploadSpeedLimit])

  const handleSaveDownloadPath = async (): Promise<void> => {
    if (!editedDownloadPath) {
      setLocalError(t('downloadPathEmpty'))
      return
    }

    try {
      setLocalError(null)
      setSaveSuccess(false)
      await setDownloadPath(editedDownloadPath)

      // Show success message
      setSaveSuccess(true)

      // Reset success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false)
      }, 3000)
    } catch (err) {
      console.error('Error saving download path:', err)
      setLocalError(t('failedToSavePath'))
    }
  }

  const handleSaveSpeedLimits = async (): Promise<void> => {
    try {
      setLocalError(null)
      setSaveSuccess(false)

      // Use the stored original KB/s values if available, otherwise calculate
      let downloadLimit: number
      let uploadLimit: number

      if (downloadSpeedInput.trim() === '') {
        downloadLimit = 0
      } else if (originalDownloadKbps.current !== null) {
        downloadLimit = originalDownloadKbps.current
      } else {
        const inputValue = parseFloat(downloadSpeedInput)
        if (isNaN(inputValue)) {
          setLocalError(t('invalidNumbers'))
          return
        }
        const factor = SPEED_UNITS.find((u) => u.value === downloadSpeedUnit)?.factor || 1
        downloadLimit = inputValue * factor
      }

      if (uploadSpeedInput.trim() === '') {
        uploadLimit = 0
      } else if (originalUploadKbps.current !== null) {
        uploadLimit = originalUploadKbps.current
      } else {
        const inputValue = parseFloat(uploadSpeedInput)
        if (isNaN(inputValue)) {
          setLocalError(t('invalidNumbers'))
          return
        }
        const factor = SPEED_UNITS.find((u) => u.value === uploadSpeedUnit)?.factor || 1
        uploadLimit = inputValue * factor
      }

      // Ensure values are non-negative
      downloadLimit = Math.max(0, downloadLimit)
      uploadLimit = Math.max(0, uploadLimit)

      // Round to integer for storage (as the API expects integers)
      const roundedDownloadLimit = Math.round(downloadLimit)
      const roundedUploadLimit = Math.round(uploadLimit)

      await setDownloadSpeedLimit(roundedDownloadLimit)
      await setUploadSpeedLimit(roundedUploadLimit)

      // Show success message
      setSaveSuccess(true)

      // Reset success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false)
      }, 3000)
    } catch (err) {
      console.error('Error saving speed limits:', err)
      setLocalError(t('failedToSaveSpeed'))
    }
  }

  const handleSelectFolder = async (): Promise<void> => {
    try {
      const selectedPath = await window.api.dialog.showDirectoryPicker()
      if (selectedPath) {
        setEditedDownloadPath(selectedPath)
      }
    } catch (err) {
      console.error('Error selecting folder:', err)
      setLocalError('Failed to select folder')
    }
  }

  // Handle unit conversion when dropdown changes
  const handleDownloadUnitChange = (newUnit: string): void => {
    if (!downloadSpeedInput.trim()) {
      // If input is empty, just change the unit
      setDownloadSpeedUnit(newUnit)
      return
    }

    const currentValue = parseFloat(downloadSpeedInput)
    if (isNaN(currentValue)) {
      // If current input is not a valid number, just change the unit
      setDownloadSpeedUnit(newUnit)
      return
    }

    const currentUnitValue = SPEED_UNITS.find((u) => u.value === downloadSpeedUnit)
    const newUnitValue = SPEED_UNITS.find((u) => u.value === newUnit)

    if (!currentUnitValue || !newUnitValue) {
      setDownloadSpeedUnit(newUnit)
      return
    }

    // If this is the first unit change, store the original KB/s value
    if (originalDownloadKbps.current === null) {
      if (downloadSpeedUnit === 'kbps') {
        originalDownloadKbps.current = currentValue
      } else {
        // Convert from current unit to KB/s
        originalDownloadKbps.current = currentValue * currentUnitValue.factor
      }
    }

    // Use the original KB/s value for conversions to prevent rounding errors
    if (originalDownloadKbps.current !== null) {
      const valueInNewUnit = originalDownloadKbps.current / newUnitValue.factor

      // Format based on the unit
      let formattedValue: string
      if (newUnit === 'mbps') {
        // For MB/s, show up to 2 decimal places, but trim trailing zeros
        formattedValue = valueInNewUnit.toFixed(2).replace(/\.?0+$/, '')
        if (formattedValue.endsWith('.')) formattedValue = formattedValue.slice(0, -1)
      } else {
        // For KB/s, show as integer
        formattedValue = Math.round(valueInNewUnit).toString()
      }

      setDownloadSpeedInput(formattedValue)
    }

    setDownloadSpeedUnit(newUnit)
  }

  const handleUploadUnitChange = (newUnit: string): void => {
    if (!uploadSpeedInput.trim()) {
      // If input is empty, just change the unit
      setUploadSpeedUnit(newUnit)
      return
    }

    const currentValue = parseFloat(uploadSpeedInput)
    if (isNaN(currentValue)) {
      // If current input is not a valid number, just change the unit
      setUploadSpeedUnit(newUnit)
      return
    }

    const currentUnitValue = SPEED_UNITS.find((u) => u.value === uploadSpeedUnit)
    const newUnitValue = SPEED_UNITS.find((u) => u.value === newUnit)

    if (!currentUnitValue || !newUnitValue) {
      setUploadSpeedUnit(newUnit)
      return
    }

    // If this is the first unit change, store the original KB/s value
    if (originalUploadKbps.current === null) {
      if (uploadSpeedUnit === 'kbps') {
        originalUploadKbps.current = currentValue
      } else {
        // Convert from current unit to KB/s
        originalUploadKbps.current = currentValue * currentUnitValue.factor
      }
    }

    // Use the original KB/s value for conversions to prevent rounding errors
    if (originalUploadKbps.current !== null) {
      const valueInNewUnit = originalUploadKbps.current / newUnitValue.factor

      // Format based on the unit
      let formattedValue: string
      if (newUnit === 'mbps') {
        // For MB/s, show up to 2 decimal places, but trim trailing zeros
        formattedValue = valueInNewUnit.toFixed(2).replace(/\.?0+$/, '')
        if (formattedValue.endsWith('.')) formattedValue = formattedValue.slice(0, -1)
      } else {
        // For KB/s, show as integer
        formattedValue = Math.round(valueInNewUnit).toString()
      }

      setUploadSpeedInput(formattedValue)
    }

    setUploadSpeedUnit(newUnit)
  }

  // Update stored KB/s value when input changes
  const handleDownloadInputChange = (value: string): void => {
    setDownloadSpeedInput(value.replace(/[^0-9.]/g, ''))

    // If the input is valid, update the original KB/s value
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      if (downloadSpeedUnit === 'kbps') {
        originalDownloadKbps.current = numValue
      } else {
        const factor = SPEED_UNITS.find((u) => u.value === downloadSpeedUnit)?.factor || 1
        originalDownloadKbps.current = numValue * factor
      }
    } else if (value.trim() === '') {
      originalDownloadKbps.current = null
    }
  }

  const handleUploadInputChange = (value: string): void => {
    setUploadSpeedInput(value.replace(/[^0-9.]/g, ''))

    // If the input is valid, update the original KB/s value
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      if (uploadSpeedUnit === 'kbps') {
        originalUploadKbps.current = numValue
      } else {
        const factor = SPEED_UNITS.find((u) => u.value === uploadSpeedUnit)?.factor || 1
        originalUploadKbps.current = numValue * factor
      }
    } else if (value.trim() === '') {
      originalUploadKbps.current = null
    }
  }

  const { t } = useLanguage()

  return (
    <div className={styles.root} style={{
      '--colorNeutralForeground1': '#39ff14',
      '--colorNeutralForeground2': 'rgba(57,255,20,0.7)',
      '--colorNeutralForeground3': 'rgba(57,255,20,0.45)',
      '--colorNeutralForeground4': 'rgba(57,255,20,0.3)',
      '--colorNeutralBackground1': '#050514',
      '--colorNeutralBackground1Hover': 'rgba(57,255,20,0.06)',
      '--colorNeutralBackground2': 'rgba(57,255,20,0.04)',
      '--colorNeutralBackground3': 'rgba(57,255,20,0.08)',
      '--colorNeutralStroke1': 'rgba(57,255,20,0.25)',
      '--colorNeutralStroke2': 'rgba(57,255,20,0.15)',
      '--colorNeutralStrokeAccessible': 'rgba(57,255,20,0.5)',
      '--colorBrandBackground': '#39ff14',
      '--colorBrandBackgroundHover': 'rgba(57,255,20,0.8)',
      '--colorBrandBackgroundPressed': 'rgba(57,255,20,0.6)',
      '--colorCompoundBrandBackground': '#39ff14',
      '--colorCompoundBrandBackgroundHover': 'rgba(57,255,20,0.8)',
      '--colorBrandForeground1': '#39ff14',
      '--colorBrandStroke1': '#39ff14',
      '--colorBrandStroke2': 'rgba(57,255,20,0.5)',
      '--colorNeutralForegroundOnBrand': '#050514',
    } as React.CSSProperties}>
      <div className={styles.contentContainer}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
          <span style={{ fontSize: '28px', fontWeight: 800, fontFamily: '"Courier New", monospace', letterSpacing: '0.04em' }}>
            <span style={{ color: '#a855f7', textShadow: '0 0 12px rgba(168,85,247,0.6)' }}>VR</span>
            {' '}
            <span style={{ color: '#39ff14', textShadow: '0 0 12px rgba(57,255,20,0.5)' }}>CyberDeck</span>
            {' '}
            <span style={{ color: '#a855f7', textShadow: '0 0 12px rgba(168,85,247,0.6)' }}>Hacks</span>
          </span>
          {isLoading && <Spinner size="large" label={t('loadingSettings')} />}
        </div>
        <span style={{ color: 'rgba(57,255,20,0.55)', fontFamily: 'monospace', fontSize: '12px', marginBottom: '8px', display: 'block' }}>
          {t('configurePreferences')}
          {appVersion && ` • Version ${appVersion}`}
        </span>

        <div>
          <SectionHeader label="// INTRO VIDEO" sectionKey="intro" openSections={openSections} onToggle={toggleSection} />
          {openSections.intro && <IntroSettings />}
        </div>

        <div>
          <SectionHeader label="// MP USERNAME" sectionKey="username" openSections={openSections} onToggle={toggleSection} />
          {openSections.username && <MpUsernameSettings />}
        </div>

        <div>
          <SectionHeader label="// LOG UPLOAD" sectionKey="logs" openSections={openSections} onToggle={toggleSection} />
          {openSections.logs && <LogUploadSettings />}
        </div>

        <SectionHeader label="// DOWNLOAD + SPEED" sectionKey="download" openSections={openSections} onToggle={toggleSection} />
        {openSections.download && <Card className={styles.card}>
          <CardHeader description={<Subtitle1 weight="semibold">{t('downloadSettings')}</Subtitle1>} />
          <div className={styles.cardContent}>
            <Text>{t('downloadSettingsDesc')}</Text>

            <div className={styles.formRow}>
              <Input
                className={styles.input}
                value={editedDownloadPath}
                onChange={(_, data) => setEditedDownloadPath(data.value)}
                placeholder={t('downloadPath')}
                contentAfter={
                  <Button
                    icon={<FolderOpenRegular />}
                    onClick={handleSelectFolder}
                    aria-label={t('browseFolders')}
                  />
                }
                size="large"
              />
              <button onClick={handleSaveDownloadPath} style={neonBtn}>{t('savePath')}</button>
            </div>

            <div className={styles.speedLimitSection}>
              <Text>{t('unlimitedHint')}</Text>

              <div className={styles.speedFormRow}>
                <div className={styles.speedControl}>
                  <Text>{t('downloadSpeedLimit')}</Text>
                  <div className={styles.speedInputGroup}>
                    <Input
                      className={styles.speedInput}
                      value={downloadSpeedInput}
                      onChange={(_, data) => handleDownloadInputChange(data.value)}
                      placeholder={t('unlimited')}
                    />
                    <Dropdown
                      className={styles.unitDropdown}
                      value={SPEED_UNITS.find((u) => u.value === downloadSpeedUnit)?.label}
                      label="Download Speed Limit Unit"
                      selectedOptions={[downloadSpeedUnit]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                          handleDownloadUnitChange(data.optionValue)
                        }
                      }}
                      mountNode={document.getElementById('portal')}
                    >
                      {SPEED_UNITS.map((unit) => (
                        <Option key={unit.value} value={unit.value} text={unit.label}>
                          {unit.label}
                        </Option>
                      ))}
                    </Dropdown>
                  </div>
                  <Text className={styles.hint}>
                    <InfoRegular />
                    {t('unlimitedHint')}
                  </Text>
                </div>

                <div className={styles.speedControl}>
                  <Text>{t('uploadSpeedLimit')}</Text>
                  <div className={styles.speedInputGroup}>
                    <Input
                      className={styles.speedInput}
                      value={uploadSpeedInput}
                      onChange={(_, data) => handleUploadInputChange(data.value)}
                      placeholder={t('unlimited')}
                    />
                    <Dropdown
                      className={styles.unitDropdown}
                      value={SPEED_UNITS.find((u) => u.value === uploadSpeedUnit)?.label}
                      selectedOptions={[uploadSpeedUnit]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                          handleUploadUnitChange(data.optionValue)
                        }
                      }}
                      mountNode={document.getElementById('portal')}
                    >
                      {SPEED_UNITS.map((unit) => (
                        <Option key={unit.value} value={unit.value} text={unit.label}>
                          {unit.label}
                        </Option>
                      ))}
                    </Dropdown>
                  </div>
                  <Text className={styles.hint}>
                    <InfoRegular />
                    {t('unlimitedHint')}
                  </Text>
                </div>
              </div>

              <div
                className={styles.formRow}
                style={{ justifyContent: 'flex-end', marginTop: tokens.spacingVerticalM }}
              >
                <button onClick={handleSaveSpeedLimits} style={neonBtn}>{t('saveSpeedLimits')}</button>
              </div>
            </div>

            {(error || localError) && <Text className={styles.error}>{error || localError}</Text>}

            {saveSuccess && (
              <Text className={styles.success}>
                <CheckmarkCircleRegular />
                {t('settingsSaved')}
              </Text>
            )}
          </div>
        </Card>}

        <div>
          <SectionHeader label="// BLACKLIST" sectionKey="blacklist" openSections={openSections} onToggle={toggleSection} />
          {openSections.blacklist && <BlacklistSettings />}
        </div>

        <div>
          <SectionHeader label="// CONTENT FILTER" sectionKey="content" openSections={openSections} onToggle={toggleSection} />
          {openSections.content && (
            <div style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ '--colorBrandBackground': '#39ff14', '--colorBrandBackgroundHover': 'rgba(57,255,20,0.8)', '--colorBrandBackgroundPressed': 'rgba(57,255,20,0.6)', '--colorCompoundBrandBackground': '#39ff14', '--colorCompoundBrandBackgroundHover': 'rgba(57,255,20,0.8)' } as React.CSSProperties}>
                  <Switch
                    checked={hideAdultContent}
                    onChange={(_, d) => {
                      setHideAdultContentLocal(d.checked)
                      try { localStorage.setItem('vrcyberdeck:hideAdult', String(d.checked)) } catch { }
                    }}
                  />
                </div>
                <span style={{ color: '#39ff14', fontFamily: 'monospace', fontSize: '12px' }}>Hide adult / explicit content</span>
              </div>
              <span style={{ color: 'rgba(57,255,20,0.45)', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.5 }}>
                Filters explicit-tagged titles from the library. Requires a game refresh to take effect.
              </span>
            </div>
          )}
        </div>

        <div>
          <SectionHeader label="// MATRIX IDENTITIES" sectionKey="matrixId" openSections={openSections} onToggle={toggleSection} />
          {openSections.matrixId && <MatrixIdentitySettings />}
        </div>

        {/* Credits footer */}
        <div className="credits-settings-footer">
          <div className="credits-settings-label">crafted with passion for the VR community</div>
          <div>
            <span className="credits-settings-main">MADE WITH ♥ BY DMP OF ARMGDDN GAMES</span>
            <button
              className="credits-settings-question-btn"
              onClick={() => setIsCreditsOpen(true)}
              title="Credits & Special Thanks"
            >
              ?
            </button>
          </div>
        </div>
      </div>

      <CreditsDialog
        open={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
        variant="settings"
      />
    </div>
  )
}

export default Settings
