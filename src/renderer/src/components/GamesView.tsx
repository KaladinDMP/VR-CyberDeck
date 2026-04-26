import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  FilterFn,
  ColumnFiltersState,
  Row,
  ColumnSizingState
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAdb } from '../hooks/useAdb'
import { useGames } from '../hooks/useGames'
import { useDownload } from '../hooks/useDownload'
import { useLanguage } from '../hooks/useLanguage'
import { GameInfo } from '@shared/types'
import placeholderImage from '../assets/images/game-placeholder.png'
import {
  Button,
  tokens,
  shorthands,
  makeStyles,
  Text,
  Input,
  Badge,
  ProgressBar,
  Spinner,
  Menu,
  MenuTrigger,
  MenuList,
  MenuItem,
  MenuPopover,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Slider,
  Switch
} from '@fluentui/react-components'
import {
  ArrowClockwiseRegular,
  DismissRegular,
  PlugDisconnectedRegular,
  CheckmarkCircleRegular,
  DesktopRegular,
  BatteryChargeRegular,
  FolderAddRegular,
  DocumentRegular,
  ChevronDownRegular,
  CopyRegular,
  WindowConsoleRegular,
  OptionsRegular,
  GridRegular,
  TableRegular,
  SettingsRegular,
  ArrowSyncRegular
} from '@fluentui/react-icons'
import { ArrowLeftRegular } from '@fluentui/react-icons'
import GameDetailsDialog from './GameDetailsDialog'
import { useGameDialog } from '@renderer/hooks/useGameDialog'
import MirrorManagement from './MirrorManagement'
import LocalUploadDialog from './LocalUploadDialog'
import { AdbShellDialog } from './AdbShellDialog'
import { useTablePreferences } from '@renderer/hooks/useTablePreferences'

// Column width constants
const COLUMN_WIDTHS = {
  STATUS: 60,
  THUMBNAIL: 90,
  VERSION: 180,
  POPULARITY: 120,
  SIZE: 90,
  LAST_UPDATED: 180,
  MIN_NAME_PACKAGE: 300 // Minimum width for name/package column
}

// Calculate fixed columns total width
const FIXED_COLUMNS_WIDTH =
  COLUMN_WIDTHS.STATUS +
  COLUMN_WIDTHS.THUMBNAIL +
  COLUMN_WIDTHS.VERSION +
  COLUMN_WIDTHS.POPULARITY +
  COLUMN_WIDTHS.SIZE +
  COLUMN_WIDTHS.LAST_UPDATED

type FilterType = 'all' | 'installed' | 'update'

// Parse "1.2 GB" / "500 MB" / "100 KB" to bytes for numeric sort
const parseSizeBytes = (s: string): number => {
  if (!s) return 0
  const m = s.match(/([0-9.]+)\s*(GB|MB|KB|B)?/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  const u = (m[2] ?? 'B').toUpperCase()
  return n * ({ B: 1, KB: 1024, MB: 1048576, GB: 1073741824 }[u] ?? 1)
}

const NEW_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000   // 30 days
const UPDATED_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000  // 7 days

function getGameBadge(game: GameInfo): 'new' | 'updated' | null {
  if (!game.lastUpdated) return null
  const age = Date.now() - new Date(game.lastUpdated).getTime()
  if (!Number.isFinite(age) || age < 0) return null
  if (age <= UPDATED_THRESHOLD_MS) return 'updated'
  if (age <= NEW_THRESHOLD_MS) return 'new'
  return null
}

const filterGameNameAndPackage: FilterFn<GameInfo> = (row, _columnId, filterValue) => {
  const searchStr = String(filterValue).toLowerCase()
  const gameName = String(row.original.name ?? '').toLowerCase()
  const packageName = String(row.original.packageName ?? '').toLowerCase()
  const releaseName = String(row.original.releaseName ?? '').toLowerCase()
  return (
    gameName.includes(searchStr) ||
    packageName.includes(searchStr) ||
    releaseName.includes(searchStr)
  )
}

declare module '@tanstack/react-table' {
  interface FilterFns {
    gameNameAndPackageFilter: FilterFn<GameInfo>
  }
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 110px)',
    overflow: 'hidden',
    backgroundColor: '#050514'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderBottom(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground3,
    flexShrink: 0
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS
  },
  deviceInfoBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS
  },
  connectedDeviceText: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS
  },
  deviceWarningText: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorPaletteRedForeground1
  },
  tableContainer: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    overflow: 'hidden'
  },
  toolbar: {
    marginBottom: tokens.spacingVerticalL,
    flexShrink: 0
  },
  filterButtons: {
    display: 'flex',
    gap: tokens.spacingHorizontalS
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM
  },
  searchInput: {
    width: '250px'
  },
  statusArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.padding(tokens.spacingVerticalXXL),
    flexGrow: 1
  },
  progressBarContainer: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    alignItems: 'center'
  },
  tableWrapper: {
    flexGrow: 1,
    overflow: 'auto',
    position: 'relative'
  },
  namePackageCellContainer: {
    position: 'relative',
    paddingBottom: '8px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  namePackageCellText: {},
  progressBarAcrossRow: {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    height: '4px'
  },
  statusIconCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  resizer: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    width: '5px',
    background: 'rgba(0, 0, 0, 0.1)',
    cursor: 'col-resize',
    userSelect: 'none',
    touchAction: 'none',
    opacity: 0,
    transition: 'opacity 0.2s ease-in-out',
    ':hover': {
      opacity: 1
    }
  },
  isResizing: {
    background: tokens.colorBrandBackground,
    opacity: 1
  },
  layout: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#050514'
  },
  sidebar: {
    width: '240px',
    minWidth: '240px',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(57,255,20,0.18)',
    backgroundColor: '#07070f',
    overflow: 'hidden',
    transition: 'width 0.2s ease, min-width 0.2s ease, opacity 0.2s ease',
    flexShrink: 0,
    position: 'relative'
  },
  sidebarCollapsed: {
    width: '0px',
    minWidth: '0px',
    opacity: 0,
    borderRight: 'none'
  },
  sidebarToggleBtn: {
    position: 'absolute',
    top: '8px',
    right: '-14px',
    zIndex: 20,
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    backgroundColor: '#07070f',
    border: '1px solid rgba(57,255,20,0.4)',
    color: '#39ff14',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
    boxShadow: '0 0 8px rgba(57,255,20,0.3)',
    transition: 'all 0.15s ease',
    flexShrink: 0
  },
  sidebarToggleFloating: {
    position: 'fixed',
    top: '120px',
    left: '6px',
    zIndex: 20,
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    backgroundColor: '#07070f',
    border: '1px solid rgba(57,255,20,0.4)',
    color: '#39ff14',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
    boxShadow: '0 0 8px rgba(57,255,20,0.3)'
  },
  sidebarToggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    flexShrink: 0,
    borderBottom: '1px solid rgba(57,255,20,0.12)'
  },
  sidebarScroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    gap: tokens.spacingVerticalS
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalM,
    borderBottom: '1px solid rgba(57,255,20,0.10)'
  },
  sidebarLabel: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#39ff14',
    opacity: 0.7,
    paddingBottom: tokens.spacingVerticalXXS
  },
  storageBarTrack: {
    height: '4px',
    borderRadius: '2px',
    backgroundColor: tokens.colorNeutralStroke1,
    overflow: 'hidden',
    marginTop: tokens.spacingVerticalXS
  },
  storageBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease'
  },
  deviceIdRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    cursor: 'pointer',
    padding: `${tokens.spacingVerticalXXS} 0`,
    overflow: 'hidden'
  },
  sidebarMain: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#050514'
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: '1px solid rgba(57,255,20,0.12)',
    backgroundColor: '#050514',
    flexShrink: 0,
    flexWrap: 'nowrap'
  },
  searchBoxWrap: {
    flex: 1,
    minWidth: '140px'
  },
  contentArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}`,
    backgroundColor: '#050514'
  }
})

interface GamesViewProps {
  onBackToDevices: () => void
  onTransfers: () => void
  onSettings: () => void
}

function parseStorageGB(s: string | null | undefined): number {
  if (!s) return 0
  const m = s.match(/(\d+(?:\.\d+)?)\s*([GT])/i)
  if (!m) return 0
  return /T/i.test(m[2]) ? parseFloat(m[1]) * 1024 : parseFloat(m[1])
}

const COLOR_SWATCHES = [
  { label: 'None',    value: 'transparent' },
  { label: 'Cyan',    value: 'rgba(0, 212, 255, 0.07)' },
  { label: 'Purple',  value: 'rgba(176, 64, 255, 0.07)' },
  { label: 'Pink',    value: 'rgba(255, 0, 180, 0.06)' },
  { label: 'Green',   value: 'rgba(0, 255, 128, 0.07)' },
  { label: 'Blue',    value: 'rgba(40, 120, 255, 0.08)' },
  { label: 'Subtle',  value: 'rgba(255, 255, 255, 0.05)' },
] as const

const GamesView: React.FC<GamesViewProps> = ({ onBackToDevices, onTransfers, onSettings }) => {
  const {
    selectedDevice,
    selectedDeviceDetails,
    isConnected,
    disconnectDevice,
    isLoading: adbLoading,
    loadPackages
  } = useAdb()
  const {
    games,
    isLoading: loadingGames,
    error: gamesError,
    lastSyncTime,
    downloadProgress,
    extractProgress,
    refreshGames,
    getNote,
    requestUploadCheck
  } = useGames()
  const {
    addToQueue: addDownloadToQueue,
    queue: downloadQueue,
    cancelDownload,
    retryDownload,
    deleteFiles
  } = useDownload()

  const styles = useStyles()
  const { t } = useLanguage()

  const [shellDialogOpen, setShellDialogOpen] = useState(false)
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { prefs, setPrefs } = useTablePreferences()
  const [globalFilter, setGlobalFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = String(e.target.value)
      setSearchInput(val)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => setGlobalFilter(val), 400)
    },
    []
  )
  const [sorting, setSorting] = useState<SortingState>(() =>
    prefs.tableSortKey ? [{ id: prefs.tableSortKey, desc: prefs.tableSortDir === 'desc' }] : []
  )
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [dialogGame, setDialogGame] = useGameDialog()
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [tableWidth, setTableWidth] = useState<number>(0)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [isManualInstalling, setIsManualInstalling] = useState<boolean>(false)
  const [installStatusMessage, setInstallStatusMessage] = useState<string>('')
  const [showInstallDialog, setShowInstallDialog] = useState<boolean>(false)
  const [installSuccess, setInstallSuccess] = useState<boolean | null>(null)
  const [showObbConfirmDialog, setShowObbConfirmDialog] = useState<boolean>(false)
  const [obbFolderToConfirm, setObbFolderToConfirm] = useState<string | null>(null)
  const [showMirrorMgmt, setShowMirrorMgmt] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  const counts = useMemo(() => {
    const total = games.length
    const installed = games.filter((g) => g.isInstalled).length
    const updates = games.filter((g) => g.hasUpdate).length
    return { total, installed, updates }
  }, [games])

  const activeTransferCount = useMemo(
    () =>
      downloadQueue.filter(
        (d) =>
          d.status === 'Downloading' ||
          d.status === 'Extracting' ||
          d.status === 'Installing' ||
          d.status === 'Queued'
      ).length,
    [downloadQueue]
  )

  // Apply density + colour CSS variables to the table scroll container so they
  // cascade to all td/th and thumbnail cells without touching inline styles on
  // every row.
  useEffect(() => {
    const el = tableContainerRef.current
    if (!el) return
    const padV  = 4  + (prefs.rowDensity / 100) * 12   // 4 → 16 px
    const thumb = 48 + (prefs.rowDensity / 100) * 42   // 48 → 90 px
    el.style.setProperty('--row-pad-v',       `${padV}px`)
    el.style.setProperty('--row-thumb-size',  `${Math.round(thumb)}px`)
    el.style.setProperty('--row-even-color',  prefs.evenRowColor)
    el.style.setProperty('--row-odd-color',   prefs.oddRowColor)
  }, [prefs])

  useEffect(() => {
    setColumnFilters((prev) => {
      const otherFilters = prev.filter((f) => f.id !== 'isInstalled' && f.id !== 'hasUpdate')
      switch (activeFilter) {
        case 'installed':
          return [...otherFilters, { id: 'isInstalled', value: true }]
        case 'update':
          return [
            ...otherFilters,
            { id: 'isInstalled', value: true },
            { id: 'hasUpdate', value: true }
          ]
        case 'all':
        default:
          return otherFilters
      }
    })
  }, [activeFilter])

  useEffect(() => {
    const unsubscribe = window.api.adb.onInstallationCompleted((deviceId) => {
      console.log(`[GamesView] Received installation-completed event for device: ${deviceId}`)
      if (selectedDevice && deviceId === selectedDevice) {
        console.log(`[GamesView] Refreshing packages for current device ${selectedDevice}...`)
        loadPackages()
          .then(() => console.log('[GamesView] Package refresh triggered successfully.'))
          .catch((err) => console.error('[GamesView] Error triggering package refresh:', err))
      } else {
        console.log(
          `[GamesView] Installation completed event for non-selected device (${deviceId}), ignoring.`
        )
      }
    })

    return () => {
      unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice, loadPackages])

  const downloadStatusMap = useMemo(() => {
    const map = new Map<string, { status: string; progress: number; speed?: string; eta?: string }>()
    downloadQueue.forEach((item) => {
      if (item.releaseName) {
        const progress =
          item.status === 'Extracting' ? (item.extractProgress ?? 0) : (item.progress ?? 0)
        map.set(item.releaseName, {
          status: item.status,
          progress: progress,
          speed: item.speed,
          eta: item.eta
        })
      }
    })
    return map
  }, [downloadQueue])

  // Ref so column cell renderers always read the latest map without re-creating column defs
  const downloadStatusMapRef = useRef(downloadStatusMap)
  downloadStatusMapRef.current = downloadStatusMap

  useEffect(() => {
    if (!tableContainerRef.current) return

    // Capture current value of ref to use in cleanup
    const currentRef = tableContainerRef.current

    const updateTableWidth = (): void => {
      if (tableContainerRef.current) {
        const newWidth = tableContainerRef.current.clientWidth
        setTableWidth(newWidth)
        // Reset all column sizing to force recalculation
        setColumnSizing({})
      }
    }

    // Initial width calculation
    updateTableWidth()

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to avoid too many updates
      window.requestAnimationFrame(updateTableWidth)
    })
    resizeObserver.observe(currentRef)

    return () => {
      resizeObserver.unobserve(currentRef)
    }
  }, [])

  const columns = useMemo<ColumnDef<GameInfo>[]>(() => {
    // Calculate dynamic width for name column, with a minimum width
    const nameColumnWidth = Math.max(
      COLUMN_WIDTHS.MIN_NAME_PACKAGE,
      tableWidth - FIXED_COLUMNS_WIDTH - 5 // 5px buffer
    )

    return [
      {
        id: 'downloadStatus',
        header: '',
        size: COLUMN_WIDTHS.STATUS,
        enableResizing: false,
        enableSorting: false,
        cell: ({ row }) => {
          const game = row.original
          const downloadInfo = game.releaseName
            ? downloadStatusMapRef.current.get(game.releaseName)
            : undefined
          const isDownloaded = downloadInfo?.status === 'Completed'
          const isInstalled = game.isInstalled
          const isUpdateAvailable = game.hasUpdate

          return (
            <div className={styles.statusIconCell}>
              <div style={{ display: 'flex', gap: tokens.spacingHorizontalXXS }}>
                {isDownloaded && (
                  <DesktopRegular
                    fontSize={16}
                    color={tokens.colorNeutralForeground3}
                    aria-label="Installed"
                  />
                )}
                {isInstalled && (
                  <CheckmarkCircleRegular
                    fontSize={16}
                    color={tokens.colorPaletteGreenForeground1}
                    aria-label="Downloaded"
                  />
                )}
                {isUpdateAvailable && (
                  <ArrowClockwiseRegular
                    fontSize={16}
                    color={tokens.colorPaletteGreenForeground1}
                    aria-label="Update Available"
                  />
                )}
              </div>
            </div>
          )
        }
      },
      {
        accessorKey: 'thumbnailPath',
        header: ' ',
        size: COLUMN_WIDTHS.THUMBNAIL,
        enableResizing: false,
        cell: ({ getValue }) => {
          const pathValue = getValue()
          const imagePath = typeof pathValue === 'string' ? pathValue : ''
          return (
            <div className="game-thumbnail-cell">
              <img
                src={imagePath ? `file://${imagePath}` : placeholderImage}
                alt="Thumbnail"
                className="game-thumbnail-img"
              />
            </div>
          )
        },
        enableSorting: false
      },
      {
        accessorKey: 'name',
        header: () => t('namePackage'),
        size: nameColumnWidth > 0 ? nameColumnWidth : COLUMN_WIDTHS.MIN_NAME_PACKAGE,
        cell: ({ row }) => {
          const game = row.original
          const downloadInfo = game.releaseName
            ? downloadStatusMapRef.current.get(game.releaseName)
            : undefined
          const isDownloading = downloadInfo?.status === 'Downloading'
          const isExtracting = downloadInfo?.status === 'Extracting'
          const isQueued = downloadInfo?.status === 'Queued'
          const isInstalling = downloadInfo?.status === 'Installing'
          const isInstallError = downloadInfo?.status === 'InstallError'

          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%',
                position: 'relative',
                paddingBottom: '8px'
              }}
            >
              <div style={{ marginBottom: tokens.spacingVerticalXS }}>
                {' '}
                <div className="game-name-main">{game.name}</div>
                <div className="game-package-sub">{game.releaseName}</div>
                <div className="game-package-sub">{game.packageName}</div>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}
              >
                {(() => {
                  const badge = getGameBadge(game)
                  if (badge === 'new') return (
                    <Badge shape="rounded" color="success" appearance="filled" size="small"
                      style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>
                      NEW
                    </Badge>
                  )
                  if (badge === 'updated') return (
                    <Badge shape="rounded" color="warning" appearance="filled" size="small"
                      style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>
                      UPDATED
                    </Badge>
                  )
                  return null
                })()}
                {isQueued && (
                  <Badge shape="rounded" color="informative" appearance="outline">
                    {t('queued')}
                  </Badge>
                )}
                {(isDownloading || isExtracting || isInstalling) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacingHorizontalXS
                    }}
                  >
                    <Spinner size="tiny" aria-label="Installing" />
                    <Badge shape="rounded" color="brand" appearance="outline">
                      {downloadInfo?.status}{isDownloading && downloadInfo?.progress != null ? ` ${downloadInfo.progress}%` : ''}
                    </Badge>
                    {isDownloading && downloadInfo?.speed && (
                      <span style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>
                        {downloadInfo.speed}
                      </span>
                    )}
                  </div>
                )}
                {isInstallError && (
                  <Badge shape="rounded" color="danger" appearance="outline">
                    {t('installError')}
                  </Badge>
                )}
              </div>
              {(isDownloading || isExtracting || isInstalling) && downloadInfo && (
                <ProgressBar
                  value={downloadInfo.progress}
                  max={100}
                  shape="rounded"
                  thickness="medium"
                  className={styles.progressBarAcrossRow}
                  aria-label={isDownloading ? 'Download progress' : 'Extraction progress'}
                />
              )}
            </div>
          )
        },
        enableResizing: true
      },
      {
        accessorKey: 'version',
        header: () => t('version'),
        size: COLUMN_WIDTHS.VERSION,
        cell: ({ row }) => {
          const listVersion = row.original.version
          const isInstalled = row.original.isInstalled
          const deviceVersion = row.original.deviceVersionCode
          const displayListVersion = listVersion ? `v${listVersion}` : '-'
          return (
            <div className="version-cell">
              <div className="list-version-main">{displayListVersion}</div>
              {isInstalled && (
                <div className="installed-version-info">
                  {deviceVersion !== undefined ? `Installed: v${deviceVersion}` : 'Installed'}
                </div>
              )}
            </div>
          )
        },
        enableResizing: true
      },
      {
        accessorKey: 'downloads',
        header: () => t('popularity'),
        size: COLUMN_WIDTHS.POPULARITY,
        cell: (info) => {
          const count = info.getValue()
          return typeof count === 'number' ? count.toLocaleString() : '-'
        },
        enableResizing: true
      },
      {
        accessorKey: 'size',
        header: () => t('size'),
        size: COLUMN_WIDTHS.SIZE,
        sortingFn: (a, b) => parseSizeBytes(a.original.size ?? '') - parseSizeBytes(b.original.size ?? ''),
        cell: (info) => {
          const sizeValue = info.getValue()
          const sizeStr = String(sizeValue || '')
          if (sizeStr === '0 MB' || !sizeStr.trim()) {
            return null
          }
          return sizeStr
        },
        enableResizing: true
      },
      {
        accessorKey: 'lastUpdated',
        header: () => t('lastUpdated'),
        size: COLUMN_WIDTHS.LAST_UPDATED,
        sortingFn: (a, b) => {
          const da = a.original.lastUpdated ? new Date(a.original.lastUpdated).getTime() : 0
          const db = b.original.lastUpdated ? new Date(b.original.lastUpdated).getTime() : 0
          return da - db
        },
        cell: (info) => info.getValue() || '-',
        enableResizing: true
      },
      {
        accessorKey: 'isInstalled',
        header: 'Installed Status',
        enableResizing: false
      },
      {
        accessorKey: 'hasUpdate',
        header: 'Update Status',
        enableResizing: false
      }
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styles, tableWidth, t])

  const filteredGames = useMemo(() => {
    let hideAdult = true
    try { hideAdult = localStorage.getItem('vrcyberdeck:hideAdult') !== 'false' } catch { /* ignore */ }
    return games.filter((game) => {
      const size = String(game.size ?? '').trim()
      if (size === '0 MB' || size === '') return false
      if (hideAdult && String(game.name ?? '').includes('18+')) return false
      return true
    })
  }, [games])

  const table = useReactTable({
    data: filteredGames,
    columns,
    columnResizeMode: 'onChange',
    filterFns: {
      gameNameAndPackageFilter: filterGameNameAndPackage
    },
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnVisibility: { isInstalled: false, hasUpdate: false },
      columnSizing
    },
    onSortingChange: (updater) => {
      setSorting((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        const first = next[0]
        setPrefs({
          tableSortKey: first?.id ?? '',
          tableSortDir: first?.desc ? 'desc' : 'asc'
        })
        return next
      })
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    globalFilterFn: 'gameNameAndPackageFilter',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  const { rows } = table.getRowModel()
  // Estimated row height scales with density: ~60 px compact → ~125 px comfortable
  const estimatedRowHeight = Math.round(60 + (prefs.rowDensity / 100) * 65)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 10
  })

  // Re-measure all virtualised rows when density changes so scroll height stays accurate
  useEffect(() => {
    rowVirtualizer.measure()
  }, [prefs.rowDensity])

  const formatDate = (date: Date | null): string => {
    if (!date) return t('never')
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getProcessMessage = (): string => {
    if (downloadProgress > 0 && downloadProgress < 100) {
      return `${t('downloadingGameData')} ${downloadProgress}%`
    } else if (extractProgress > 0 && extractProgress < 100) {
      return `${t('extractingGameData')} ${extractProgress}%`
    } else if (loadingGames) {
      return t('preparingLibrary')
    }
    return ''
  }

  const getCurrentProgress = (): number => {
    if (downloadProgress > 0 && downloadProgress < 100) {
      return downloadProgress
    } else if (extractProgress > 0 && extractProgress < 100) {
      return extractProgress
    }
    return 0
  }

  const handleRowClick = (
    _event: React.MouseEvent<HTMLTableRowElement>,
    row: Row<GameInfo>
  ): void => {
    console.log('Row clicked for game:', row.original.name)
    setDialogGame(row.original)
    setIsDialogOpen(true)
  }

  useEffect(() => {
    if (dialogGame) {
      setIsDialogOpen(true)
    }
  }, [dialogGame])

  const handleCloseDialog = useCallback((): void => {
    setIsDialogOpen(false)
    setTimeout(() => {
      setDialogGame(null)
    }, 300)
  }, [setDialogGame])

  const handleInstall = (game: GameInfo): void => {
    if (!game) return
    console.log('Install action triggered for:', game.packageName)
    addDownloadToQueue(game)
      .then((success) => {
        if (success) {
          console.log(`Successfully added ${game.releaseName} to download queue.`)
        } else {
          console.log(`Failed to add ${game.releaseName} to queue (might already exist).`)
        }
      })
      .catch((err) => {
        console.error('Error adding to queue:', err)
      })
  }

  const handleUninstall = async (game: GameInfo): Promise<void> => {
    if (!game || !game.packageName || !selectedDevice) {
      console.error(
        'Uninstall action aborted: Missing game data, package name, or selectedDevice.',
        {
          game,
          selectedDevice
        }
      )
      window.alert('Cannot start uninstall: Essential information is missing.')
      return
    }

    console.log(`Uninstall: Starting for ${game.name} (${game.packageName}) on ${selectedDevice}.`)
    setIsLoading(true)

    try {
      const success = await window.api.adb.uninstallPackage(selectedDevice, game.packageName)
      if (success) {
        console.log(`Uninstall: Successfully uninstalled ${game.packageName}.`)
      } else {
        console.error(`Uninstall: Failed to uninstall ${game.packageName}.`)
        window.alert('Failed to uninstall the game.')
      }
      await loadPackages()
    } catch (error) {
      console.error(`Uninstall: Error during process for ${game.name}:`, error)
      window.alert(
        `An error occurred during the uninstall process for ${game.name}. Please check logs.`
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleReinstall = async (game: GameInfo): Promise<void> => {
    if (!game || !game.packageName || !game.releaseName || !selectedDevice) {
      console.error(
        'Reinstall Error: Missing game data, package name, release name, or device ID.',
        {
          game,
          selectedDevice
        }
      )
      window.alert('Cannot start reinstall: Essential information is missing.')
      return
    }

    console.log(`Reinstall: Starting for ${game.name} (${game.packageName}) on ${selectedDevice}.`)
    setIsLoading(true)

    try {
      // Step 1: Uninstall the package
      console.log(`Reinstall: Attempting to uninstall ${game.packageName}...`)
      const uninstallSuccess = await window.api.adb.uninstallPackage(
        selectedDevice,
        game.packageName
      )

      if (uninstallSuccess) {
        console.log(`Reinstall: Successfully uninstalled ${game.packageName}.`)
        // The game is now uninstalled from the device.
        // Downloaded files (if any) should still be present.

        const downloadInfo = downloadStatusMap.get(game.releaseName)

        if (downloadInfo?.status === 'Completed') {
          console.log(
            `Reinstall: Files for ${game.releaseName} are 'Completed'. Initiating install from completed.`
          )
          await window.api.downloads.installFromCompleted(game.releaseName, selectedDevice)
          console.log(`Reinstall: 'installFromCompleted' called for ${game.releaseName}.`)
        } else {
          console.log(
            `Reinstall: Files for ${game.releaseName} not 'Completed' (status: ${downloadInfo?.status}). Adding to download queue.`
          )
          const addToQueueSuccess = await addDownloadToQueue(game)
          if (addToQueueSuccess) {
            console.log(`Reinstall: Successfully added ${game.releaseName} to download queue.`)
          } else {
            console.warn(
              `Reinstall: Failed to add ${game.releaseName} to queue. Current status: ${downloadInfo?.status}.`
            )
            window.alert(
              `Reinstall for ${game.name} failed: Could not add to download queue. Please check logs.`
            )
          }
        }
      } else {
        console.error(
          `Reinstall: Failed to uninstall ${game.packageName}. Installation step will be skipped.`
        )
        window.alert(`Failed to uninstall ${game.name}. Reinstall aborted.`)
      }
    } catch (error) {
      console.error(`Reinstall: Error during process for ${game.name}:`, error)
      window.alert(
        `An error occurred during the reinstall process for ${game.name}. Please check logs.`
      )
    } finally {
      setIsLoading(false)
      // Refresh packages to update UI. The 'installation-completed' event should also trigger this,
      // but it's good to have a fallback or an immediate refresh after the uninstall part.
      console.log(`Reinstall: Process finished for ${game.name}. Triggering package refresh.`)
      loadPackages().catch((err) =>
        console.error('Reinstall: Error refreshing packages post-operation:', err)
      )
    }
  }

  const handleUpdate = async (game: GameInfo): Promise<void> => {
    if (!game || !game.releaseName || !selectedDevice) {
      console.error('Update action aborted: Missing game data, releaseName, or selectedDevice.', {
        game,
        selectedDevice
      })
      window.alert('Cannot start update: Essential information is missing.')
      handleCloseDialog()
      return
    }

    console.log(
      `Update action triggered for: ${game.name} (${game.packageName}) on ${selectedDevice}`
    )

    try {
      const downloadInfo = downloadStatusMap.get(game.releaseName)

      if (downloadInfo?.status === 'Completed') {
        console.log(
          `Update for ${game.releaseName}: Files are already 'Completed'. Initiating install from completed.`
        )
        await window.api.downloads.installFromCompleted(game.releaseName, selectedDevice)
        console.log(`Update: 'installFromCompleted' called for ${game.releaseName}.`)
        // Optionally, refresh packages or rely on 'installation-completed' event
        // loadPackages().catch(err => console.error('Update: Error refreshing packages post-install:', err));
      } else {
        console.log(
          `Update for ${game.releaseName}: Files not 'Completed' (status: ${downloadInfo?.status}). Adding to download queue.`
        )
        const addToQueueSuccess = await addDownloadToQueue(game)
        if (addToQueueSuccess) {
          console.log(`Update: Successfully added ${game.releaseName} to download queue.`)
        } else {
          console.warn(
            `Update: Failed to add ${game.releaseName} to queue. Current status: ${downloadInfo?.status}.`
          )
          window.alert(
            `Could not queue ${game.name} for update. It might already be in the queue or an error occurred. Please check logs.`
          )
        }
      }
    } catch (error) {
      console.error(`Update: Error during process for ${game.name}:`, error)
      window.alert(
        `An error occurred during the update process for ${game.name}. Please check logs.`
      )
    }
  }

  const handleRetry = (game: GameInfo): void => {
    if (!game || !game.releaseName) return
    console.log('Retry action triggered for:', game.releaseName)
    retryDownload(game.releaseName)
  }

  const handleCancelDownload = (game: GameInfo): void => {
    if (!game || !game.releaseName) return
    console.log('Cancel download/extraction action triggered for:', game.releaseName)
    cancelDownload(game.releaseName)
  }

  const handleInstallFromCompleted = (game: GameInfo): void => {
    if (!game || !game.releaseName || !selectedDevice) {
      console.error('Missing game, releaseName, or deviceId for install from completed action')
      window.alert('Cannot start installation: Missing required information.')
      return
    }
    console.log(`Requesting install from completed for ${game.releaseName} on ${selectedDevice}`)
    window.api.downloads.installFromCompleted(game.releaseName, selectedDevice).catch((err) => {
      console.error('Error triggering install from completed:', err)
      window.alert('Failed to start installation. Please check the main process logs.')
    })
  }

  const handleDeleteDownloaded = useCallback(
    async (game: GameInfo | null): Promise<void> => {
      if (!game || !game.releaseName) return
      console.log('Delete downloaded files action triggered for:', game.releaseName)
      try {
        const success = await deleteFiles(game.releaseName)
        if (success) {
          console.log(`Successfully requested deletion of files for ${game.releaseName}.`)
        } else {
          console.error(`Failed to delete files for ${game.releaseName}.`)
          window.alert('Failed to delete downloaded files. Check logs.')
        }
      } catch (error) {
        console.error('Error calling deleteFiles:', error)
        window.alert('An error occurred while trying to delete downloaded files.')
      }
      handleCloseDialog()
    },
    [deleteFiles, handleCloseDialog]
  )

  const handleManualInstall = useCallback(
    async (type: 'apk' | 'folder') => {
      if (!isConnected || !selectedDevice) {
        window.alert('Please connect to a device first.')
        return
      }

      try {
        let filePath: string | null = null
        let itemName: string = ''

        if (type === 'apk') {
          filePath = await window.api.dialog.showApkFilePicker()
          itemName = 'APK file'
        } else {
          filePath = await window.api.dialog.showFolderPicker()
          itemName = 'folder'
        }

        if (!filePath) {
          return // User cancelled the dialog
        }

        const fileName = filePath.split(/[/\\]/).pop() || filePath
        console.log(`${itemName} install requested for: ${filePath}`)

        // Show the installation dialog
        setShowInstallDialog(true)
        setIsManualInstalling(true)
        setInstallStatusMessage(`Installing ${itemName}: ${fileName}...`)
        setInstallSuccess(null)

        const success = await window.api.downloads.installManualFile(filePath, selectedDevice)

        setInstallSuccess(success)

        if (success) {
          console.log(`${itemName} installation successful for: ${filePath}`)
          setInstallStatusMessage(`✅ "${fileName}" installed successfully!`)
          // Refresh packages to update the UI
          await loadPackages()
        } else {
          console.error(`${itemName} installation failed for: ${filePath}`)
          setInstallStatusMessage(`❌ Failed to install "${fileName}"`)
        }
      } catch (error) {
        console.error(`Error during ${type} installation:`, error)
        setInstallStatusMessage('❌ Installation error occurred')
        setInstallSuccess(false)
      } finally {
        setIsManualInstalling(false)
      }
    },
    [isConnected, selectedDevice, loadPackages]
  )

  const handleCopyObbFolder = useCallback(async () => {
    if (!isConnected || !selectedDevice) {
      window.alert('Please connect to a device first.')
      return
    }

    try {
      const folderPath = await window.api.dialog.showFolderPicker()

      if (!folderPath) {
        return // User cancelled the dialog
      }

      const folderName = folderPath.split(/[/\\]/).pop() || folderPath
      console.log(`OBB folder copy requested for: ${folderPath}`)

      // Check if there's a corresponding package installed
      try {
        const installedPackages = await window.api.adb.getInstalledPackages(selectedDevice)
        const matchingPackage = installedPackages.find((pkg) => pkg.packageName === folderName)
        console.log('installedPackages', installedPackages)
        console.log('matchingPackage', matchingPackage)
        if (!matchingPackage) {
          // No matching package found, show confirmation dialog
          console.log(`No matching package found for folder: ${folderName}`)
          setObbFolderToConfirm(folderPath)
          setShowObbConfirmDialog(true)
          return
        }

        console.log(`Found matching package for folder: ${folderName}`)
      } catch (error) {
        console.error('Error checking installed packages:', error)
        // If we can't check packages, show a warning but let user proceed
        const proceed = window.confirm(
          `Could not verify installed packages. Do you want to proceed with copying "${folderName}" to the OBB directory?`
        )
        if (!proceed) {
          return
        }
      }

      // Proceed with copying
      await performObbCopy(folderPath)
    } catch (error) {
      console.error(`Error during OBB folder copy:`, error)
      setInstallStatusMessage('❌ OBB copy error occurred')
      setInstallSuccess(false)
      setShowInstallDialog(true)
      setIsManualInstalling(false)
    }
  }, [isConnected, selectedDevice])

  const performObbCopy = useCallback(
    async (folderPath: string) => {
      if (!selectedDevice) return

      const folderName = folderPath.split(/[/\\]/).pop() || folderPath

      // Show the installation dialog
      setShowInstallDialog(true)
      setIsManualInstalling(true)
      setInstallStatusMessage(`Copying OBB folder: ${folderName}...`)
      setInstallSuccess(null)

      try {
        const success = await window.api.downloads.copyObbFolder(folderPath, selectedDevice)

        setInstallSuccess(success)

        if (success) {
          console.log(`OBB folder copy successful for: ${folderPath}`)
          setInstallStatusMessage(`✅ "${folderName}" copied to OBB directory successfully!`)
        } else {
          console.error(`OBB folder copy failed for: ${folderPath}`)
          setInstallStatusMessage(`❌ Failed to copy "${folderName}" to OBB directory`)
        }
      } catch (error) {
        console.error(`Error during OBB folder copy:`, error)
        setInstallStatusMessage('❌ OBB copy error occurred')
        setInstallSuccess(false)
      } finally {
        setIsManualInstalling(false)
      }
    },
    [selectedDevice]
  )

  const handleObbConfirmCopy = useCallback(async () => {
    if (!obbFolderToConfirm) return

    setShowObbConfirmDialog(false)
    await performObbCopy(obbFolderToConfirm)
    setObbFolderToConfirm(null)
  }, [obbFolderToConfirm, performObbCopy])

  const handleObbCancelCopy = useCallback(() => {
    setShowObbConfirmDialog(false)
    setObbFolderToConfirm(null)
  }, [])

  const closeInstallDialog = useCallback(() => {
    setShowInstallDialog(false)
    setInstallSuccess(null)
    setInstallStatusMessage('')
  }, [])

  useEffect(() => {
    let mounted = true
    const p = window.api.app?.getVersion?.()
    if (p) p.then((v) => { if (mounted) setAppVersion(v) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  const isBusy = adbLoading || loadingGames || isLoading || isManualInstalling

  const storageFreeGB = parseStorageGB(selectedDeviceDetails?.storageFree)
  const storageTotalGB = parseStorageGB(selectedDeviceDetails?.storageTotal)
  const storageUsedPct =
    storageTotalGB > 0 ? Math.min(100, Math.round(((storageTotalGB - storageFreeGB) / storageTotalGB) * 100)) : 0
  const storageBarColor =
    storageUsedPct > 85
      ? tokens.colorPaletteRedForeground1
      : storageUsedPct > 65
        ? '#ffaa00'
        : '#39ff14'

  const CB: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(57,255,20,0.45)',
    color: '#39ff14',
    width: '100%',
    justifyContent: 'center',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '11px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    boxShadow: '0 0 6px rgba(57,255,20,0.12)'
  }
  const CBP: React.CSSProperties = {
    ...CB,
    border: '1px solid rgba(176,64,255,0.5)',
    color: '#b040ff',
    boxShadow: '0 0 6px rgba(176,64,255,0.18)'
  }
  const CBR: React.CSSProperties = {
    ...CB,
    border: '1px solid rgba(255,50,50,0.5)',
    color: '#ff5555',
    boxShadow: '0 0 6px rgba(255,50,50,0.12)'
  }

  return (
    <div className={styles.root} style={{ '--colorNeutralBackground1': '#050514', '--colorNeutralBackground2': '#060615', '--colorNeutralBackground3': '#060615', '--colorNeutralForeground1': '#39ff14', '--colorNeutralForeground2': 'rgba(57,255,20,0.75)', '--colorNeutralStroke1': 'rgba(57,255,20,0.2)', '--colorNeutralStrokeAccessible': 'rgba(57,255,20,0.3)', '--colorBrandBackground': '#39ff14', '--colorNeutralForegroundOnBrand': '#050514' } as React.CSSProperties}>
      <div className={styles.layout}>

        {/* ════════════ SIDEBAR ════════════ */}
        {/* Floating open button shown only when sidebar is collapsed */}
        {!sidebarOpen && (
          <button
            className={styles.sidebarToggleFloating}
            onClick={() => setSidebarOpen(true)}
            title="Expand sidebar"
          >
            »
          </button>
        )}

        <div className={`${styles.sidebar} ${!sidebarOpen ? styles.sidebarCollapsed : ''}`}>
          {/* Collapse toggle — sits on the right edge of the sidebar */}
          <button
            className={styles.sidebarToggleBtn}
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
          >
            «
          </button>

          <div className={styles.sidebarScroll}>

            {/* ── DEVICE ── */}
            <section className={styles.sidebarSection}>
              <div className={styles.sidebarLabel}>Device</div>
              {selectedDeviceDetails ? (
                <div style={{ border: '1px solid rgba(57,255,20,0.4)', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'rgba(57,255,20,0.03)' }}>
                  {/* Device name with green dot */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#39ff14', boxShadow: '0 0 6px #39ff14', flexShrink: 0 }} />
                    <Text weight="semibold" style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(selectedDeviceDetails.friendlyModelName || 'Connected Device')
                        .split(' ')
                        .map((word, i) => (
                          <span key={i} style={{ color: i % 2 === 0 ? '#39ff14' : '#a855f7' }}>{i > 0 ? ' ' : ''}{word}</span>
                        ))}
                    </Text>
                  </div>

                  {/* Disconnect centered below name */}
                  {isConnected && (
                    <Button appearance="subtle" size="small" icon={<PlugDisconnectedRegular />}
                      onClick={() => { requestUploadCheck(); disconnectDevice() }}
                      title={t('disconnectFromDevice')} style={CB}>
                      Disconnect
                    </Button>
                  )}

                  {/* Battery badge centered */}
                  {selectedDeviceDetails.batteryLevel !== null && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Badge appearance="outline" color={selectedDeviceDetails.batteryLevel > 20 ? 'success' : 'danger'} icon={<BatteryChargeRegular />}>
                        {selectedDeviceDetails.batteryLevel}%
                      </Badge>
                    </div>
                  )}

                  {/* Storage bar + centered text */}
                  {selectedDeviceDetails.storageFree && selectedDeviceDetails.storageTotal && (
                    <>
                      <Text size={100} style={{ color: tokens.colorNeutralForeground3, textAlign: 'center', fontFamily: 'monospace' }}>
                        {selectedDeviceDetails.storageFree} Free ({100 - storageUsedPct}%) / {selectedDeviceDetails.storageTotal}
                      </Text>
                      <div className={styles.storageBarTrack}>
                        <div className={styles.storageBarFill} style={{ width: `${storageUsedPct}%`, backgroundColor: storageBarColor }} />
                      </div>
                    </>
                  )}

                  {/* Refresh Quest */}
                  {isConnected && (
                    <Button appearance="subtle" size="small" icon={<ArrowClockwiseRegular />} onClick={() => loadPackages()} disabled={isBusy}
                      style={CB}>
                      {isBusy ? t('working') : t('refreshQuest')}
                    </Button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ff4444', boxShadow: '0 0 6px #ff4444', flexShrink: 0 }} />
                  <div>
                    <Text size={200} style={{ color: '#ff6666', display: 'block' }}>No device connected</Text>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                      <button onClick={onBackToDevices} style={{ background: 'none', border: 'none', color: 'rgba(57,255,20,0.7)', cursor: 'pointer', fontSize: '11px', padding: 0, textDecoration: 'underline' }}>
                        Click to connect a headset
                      </button>
                    </Text>
                  </div>
                </div>
              )}
            </section>

            {/* ── ACTIONS ── */}
            <section className={styles.sidebarSection}>
              <div className={styles.sidebarLabel}>Actions</div>
              <Button appearance="subtle" size="small" onClick={() => setShowMirrorMgmt(true)} style={CB}>
                Manage Mirrors
              </Button>
              <Button appearance="subtle" size="small" icon={<ArrowClockwiseRegular />} onClick={refreshGames} disabled={isBusy}
                style={CB}>
                {isBusy ? t('working') : t('refreshGames')}
              </Button>
              <Button appearance="subtle" size="small" icon={<WindowConsoleRegular />} onClick={() => setShellDialogOpen(true)}
                disabled={!isConnected} style={isConnected ? CB : { ...CB, opacity: 0.4 }}>
                ADB Shell
              </Button>
              <Button appearance="subtle" size="small" icon={<SettingsRegular />} onClick={onSettings} style={CB}>
                Other Settings
              </Button>
            </section>

            {/* ── TRANSFERS ── */}
            <section className={styles.sidebarSection}>
              <div className={styles.sidebarLabel}>Transfers</div>
              <Button appearance="subtle" size="small" icon={<ArrowSyncRegular />} onClick={onTransfers} style={CBP}>
                Transfers
                {activeTransferCount > 0 && (
                  <Badge appearance="filled" color="brand" size="small" style={{ marginLeft: 'auto' }}>{activeTransferCount}</Badge>
                )}
              </Button>
              <LocalUploadDialog />
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button appearance="subtle" size="small" icon={<FolderAddRegular />} disabled={isBusy || !isConnected}
                    style={CB}>
                    {isManualInstalling ? t('manualInstalling') : 'Manual Install'}
                  </Button>
                </MenuTrigger>
                <MenuPopover style={{ background: '#050514', border: '1px solid rgba(57,255,20,0.35)', ['--colorNeutralBackground1' as string]: '#050514', ['--colorNeutralForeground1' as string]: '#39ff14', ['--colorNeutralForeground2' as string]: 'rgba(57,255,20,0.75)', ['--colorNeutralStroke1' as string]: 'rgba(57,255,20,0.2)' } as React.CSSProperties}>
                  <MenuList>
                    <MenuItem icon={<DocumentRegular />} onClick={() => handleManualInstall('apk')} disabled={isManualInstalling}>{t('installApkFile')}</MenuItem>
                    <MenuItem icon={<FolderAddRegular />} onClick={() => handleManualInstall('folder')} disabled={isManualInstalling}>{t('installFolder')}</MenuItem>
                    <MenuItem icon={<CopyRegular />} onClick={handleCopyObbFolder} disabled={isManualInstalling}>{t('copyObbFolder')}</MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            </section>

          </div>

          {/* ── SIDEBAR FOOTER — outside scroll so always visible ── */}
          <div style={{ flexShrink: 0, borderTop: '1px solid rgba(57,255,20,0.10)', padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            {appVersion && (
              <Text size={100} style={{ color: 'rgba(57,255,20,0.5)', fontFamily: 'monospace', letterSpacing: '0.12em' }}>
                v{appVersion}
              </Text>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="https://github.com/kaladindmp/vr-cyberdeck" target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(57,255,20,0.55)', fontSize: '9px', letterSpacing: '0.1em', textDecoration: 'none', fontFamily: 'monospace' }}>G|THU|3</a>
              <a href="https://t.me/s/the_vrSrc/2" target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(57,255,20,0.55)', fontSize: '9px', letterSpacing: '0.1em', textDecoration: 'none', fontFamily: 'monospace' }}>T3/_3GR4M</a>
              <a href="https://qpmegathread.top" target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(57,255,20,0.55)', fontSize: '9px', letterSpacing: '0.1em', textDecoration: 'none', fontFamily: 'monospace' }}>|V|3G4THR34D</a>
            </div>
            <Text size={100} style={{ color: 'rgba(57,255,20,0.3)', textAlign: 'center', fontFamily: 'monospace', fontSize: '8px' }}>
              {t('lastSynced')} {formatDate(lastSyncTime)}
            </Text>
          </div>
        </div>

        {/* ════════════ MAIN ════════════ */}
        <div className={styles.sidebarMain}>

          {/* Control Row */}
          <div className={styles.controlRow}>
            <div className="search-wrap" style={{ flex: 1, minWidth: '140px' }}>
              <Input
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={t('searchPlaceholder')}
                type="search"
                style={{ width: '100%' }}
              />
            </div>
            <div className="filter-buttons" style={{ margin: 0 }}>
              <button onClick={() => setActiveFilter('all')} className={activeFilter === 'all' ? 'active' : ''}>
                {t('filterAll')} ({counts.total})
              </button>
              <button onClick={() => setActiveFilter('installed')} className={activeFilter === 'installed' ? 'active' : ''}>
                {t('filterInstalled')} ({counts.installed})
              </button>
              <button onClick={() => setActiveFilter('update')} className={activeFilter === 'update' ? 'active' : ''} disabled={counts.updates === 0}>
                {t('filterUpdates')} ({counts.updates})
              </button>
            </div>
            <span className="game-count">{table.getFilteredRowModel().rows.length} {t('displayed')}</span>
            <Button
              appearance="subtle"
              size="small"
              icon={prefs.viewMode === 'table' ? <GridRegular /> : <TableRegular />}
              onClick={() => {
                const next = prefs.viewMode === 'table' ? 'cards' : 'table'
                setPrefs({ viewMode: next })
                if (next === 'cards' && prefs.cardSortKey) {
                  setSorting([{ id: prefs.cardSortKey, desc: prefs.cardSortDir === 'desc' }])
                } else if (next === 'table') {
                  setSorting([])
                }
              }}
              title={prefs.viewMode === 'table' ? 'Switch to card view' : 'Switch to table view'}
              style={{ color: 'rgba(57,255,20,0.7)', border: '1px solid rgba(57,255,20,0.3)', borderRadius: '6px' }}
            />
            <Popover open={viewOptionsOpen} onOpenChange={(_, d) => setViewOptionsOpen(d.open)} positioning="below-end">
              <PopoverTrigger>
                <Button appearance="subtle" icon={<OptionsRegular />}
                  title={prefs.viewMode === 'cards' ? 'Card view options' : 'Display options'}
                  size="small"
                  style={{ color: 'rgba(57,255,20,0.7)', border: '1px solid rgba(57,255,20,0.3)', borderRadius: '6px' }} />
              </PopoverTrigger>
              <PopoverSurface style={{ minWidth: '260px', background: '#050514', border: '1px solid rgba(57,255,20,0.3)', ['--colorNeutralForeground1' as string]: '#39ff14', ['--colorNeutralForeground2' as string]: 'rgba(57,255,20,0.75)', ['--colorNeutralBackground1' as string]: '#050514', ['--colorNeutralStroke1' as string]: 'rgba(57,255,20,0.25)', ['--colorBrandBackground' as string]: '#39ff14', ['--colorNeutralForegroundOnBrand' as string]: '#050514' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                  {prefs.viewMode === 'cards' ? (
                    <>
                      <Text weight="semibold">Card View Options</Text>
                      <div>
                        <Text size={200}>Card Size</Text>
                        <Slider min={0} max={100} value={prefs.cardSize} onChange={(_, d) => setPrefs({ cardSize: d.value })} />
                      </div>
                      <div>
                        <Text size={200}>Sort By</Text>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <select
                            value={prefs.cardSortKey}
                            onChange={(e) => {
                              const key = e.target.value
                              setPrefs({ cardSortKey: key })
                              setSorting(key ? [{ id: key, desc: prefs.cardSortDir === 'desc' }] : [])
                            }}
                            style={{ flex: 1, background: '#050514', color: '#39ff14', border: '1px solid rgba(57,255,20,0.35)', borderRadius: 4, padding: '3px 6px', fontFamily: 'monospace', fontSize: 12, cursor: 'pointer' }}
                          >
                            <option value="name">Name</option>
                            <option value="size">Size</option>
                            <option value="downloads">Popularity</option>
                            <option value="lastUpdated">Last Updated</option>
                            <option value="version">Version</option>
                          </select>
                          <button
                            onClick={() => {
                              const dir = prefs.cardSortDir === 'asc' ? 'desc' : 'asc'
                              setPrefs({ cardSortDir: dir })
                              if (prefs.cardSortKey) setSorting([{ id: prefs.cardSortKey, desc: dir === 'desc' }])
                            }}
                            style={{ background: 'transparent', border: '1px solid rgba(57,255,20,0.35)', borderRadius: 4, color: '#39ff14', cursor: 'pointer', padding: '3px 8px', fontFamily: 'monospace' }}
                          >
                            {prefs.cardSortDir === 'asc' ? '▲ ASC' : '▼ DESC'}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Text weight="semibold">Display Options</Text>
                      <div>
                        <Text size={200}>Row Density</Text>
                        <Slider min={0} max={100} value={prefs.rowDensity} onChange={(_, d) => setPrefs({ rowDensity: d.value })} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text size={200}>Alternating rows</Text>
                        <Switch checked={prefs.alternatingRows} onChange={(_, d) => setPrefs({ alternatingRows: d.checked })} />
                      </div>
                      {prefs.alternatingRows && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS }}>
                          {(
                            [
                              { label: 'Even row colour', key: 'evenRowColor' as const },
                              { label: 'Odd row colour', key: 'oddRowColor' as const }
                            ] as { label: string; key: 'evenRowColor' | 'oddRowColor' }[]
                          ).map(({ label, key }) => (
                            <div key={key}>
                              <Text size={200}>{label}</Text>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                {COLOR_SWATCHES.map((sw) => (
                                  <button key={sw.label} title={sw.label}
                                    style={{ width: '22px', height: '22px', borderRadius: '4px', padding: 0, cursor: 'pointer', background: sw.value, border: prefs[key] === sw.value ? '2px solid #00d4ff' : '1px solid rgba(128,128,128,0.3)' }}
                                    onClick={() => setPrefs({ [key]: sw.value })} />
                                ))}
                                <input type="color"
                                  value={prefs[key] === 'transparent' ? '#000000' : prefs[key]}
                                  title="Custom colour"
                                  style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.3)', padding: 0, cursor: 'pointer', background: 'none' }}
                                  onChange={(e) => setPrefs({ [key]: e.target.value })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </PopoverSurface>
            </Popover>
          </div>

          {/* Status messages */}
          {isBusy && !loadingGames && !downloadProgress && !extractProgress && (
            <div className="loading-indicator">{t('processing')}</div>
          )}
          {installStatusMessage && <div className="loading-indicator">{installStatusMessage}</div>}
          {loadingGames && (downloadProgress > 0 || extractProgress > 0) && (
            <div className="download-progress">
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${getCurrentProgress()}%` }} />
              </div>
              <div className="progress-text">{getProcessMessage()}</div>
            </div>
          )}

          {/* Content area */}
          <div className={styles.contentArea}>
            {loadingGames ? (
              <div className="loading-indicator">{t('loadingGamesLibrary')}</div>
            ) : gamesError ? (
              <div className="error-message">{gamesError}</div>
            ) : games.length === 0 && !loadingGames ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', flex: 1, padding: '40px 20px' }}>
                <svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="20" width="48" height="28" rx="14" stroke="rgba(57,255,20,0.45)" strokeWidth="2" fill="rgba(57,255,20,0.04)"/>
                  <path d="M20 32h-6M17 29v6" stroke="rgba(57,255,20,0.7)" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="44" cy="29" r="2.5" fill="rgba(176,64,255,0.7)"/>
                  <circle cx="50" cy="32" r="2.5" fill="rgba(57,255,20,0.7)"/>
                  <circle cx="44" cy="35" r="2.5" fill="rgba(57,255,20,0.5)"/>
                  <circle cx="38" cy="32" r="2.5" fill="rgba(255,100,0,0.6)"/>
                  <path d="M14 44 Q10 54 15 58" stroke="rgba(57,255,20,0.3)" strokeWidth="2" strokeLinecap="round" fill="none"/>
                  <path d="M50 44 Q54 54 49 58" stroke="rgba(57,255,20,0.3)" strokeWidth="2" strokeLinecap="round" fill="none"/>
                </svg>
                <div style={{ textAlign: 'center' }}>
                  <Text size={500} weight="semibold" style={{ display: 'block', marginBottom: '8px' }}>No games found</Text>
                  <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>Click Refresh Games to sync the game library</Text>
                </div>
                <Button appearance="subtle" size="medium" icon={<ArrowClockwiseRegular />} onClick={refreshGames} disabled={isBusy}
                  style={{ background: 'transparent', border: '1px solid rgba(57,255,20,0.45)', color: '#39ff14', letterSpacing: '0.1em', boxShadow: '0 0 6px rgba(57,255,20,0.12)' }}>
                  {isBusy ? t('working') : t('refreshGames')}
                </Button>
              </div>
            ) : (
              <>
                {prefs.viewMode === 'cards' ? (
                  <div
                    className="games-card-grid"
                    style={{ '--card-min-w': `${140 + Math.round(prefs.cardSize * 1.4)}px` } as React.CSSProperties}
                  >
                    {rows.map((row) => {
                      const game = row.original
                      const ds = game.releaseName ? downloadStatusMap.get(game.releaseName) : undefined
                      return (
                        <div
                          key={row.id}
                          className="game-card"
                          onClick={() => { setDialogGame(game); setIsDialogOpen(true) }}
                        >
                          <div className="game-card-thumbnail-wrap">
                            <img src={game.thumbnailPath ? `file://${game.thumbnailPath}` : placeholderImage} alt={game.name} />
                            {game.isInstalled ? (
                              <span className={`game-card-badge ${game.hasUpdate ? 'update' : 'installed'}`}>
                                {game.hasUpdate ? 'Update' : 'Installed'}
                              </span>
                            ) : (() => {
                              const badge = getGameBadge(game)
                              if (badge === 'new') return <span className="game-card-badge new-game">NEW</span>
                              if (badge === 'updated') return <span className="game-card-badge updated-game">UPDATED</span>
                              return null
                            })()}
                          </div>
                          <div className="game-card-body">
                            <div className="game-card-title">{game.name}</div>
                            <div className="game-card-meta">v{game.version}{game.size ? ` · ${game.size}` : ''}</div>
                            {ds && ds.status !== 'Completed' && (
                              <div className="game-card-status-text">{ds.status}{ds.progress ? ` ${ds.progress}%` : ''}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div
                    className={`table-wrapper${prefs.alternatingRows ? ' alternating-rows' : ''}`}
                    ref={tableContainerRef}
                  >
                    <table className="games-table" style={{ width: table.getTotalSize() }}>
                      <thead style={{ display: 'grid', position: 'sticky', top: 0, zIndex: 1 }}>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <th key={header.id} colSpan={header.colSpan} style={{ width: header.getSize(), position: 'relative' }}>
                                {header.isPlaceholder ? null : (
                                  <div
                                    {...{
                                      className: header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                                      onClick: header.column.getToggleSortingHandler()
                                    }}
                                  >
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                    {header.column.getIsSorted() === 'asc' && <span style={{ color: '#39ff14', marginLeft: '4px', fontSize: '10px' }}>▲</span>}
                                    {header.column.getIsSorted() === 'desc' && <span style={{ color: '#a855f7', marginLeft: '4px', fontSize: '10px' }}>▼</span>}
                                    {!header.column.getIsSorted() && header.column.getCanSort() && <span style={{ color: 'rgba(57,255,20,0.2)', marginLeft: '4px', fontSize: '10px' }}>⇅</span>}
                                  </div>
                                )}
                                {header.column.getCanResize() && (
                                  <div
                                    onMouseDown={header.getResizeHandler()}
                                    onTouchStart={header.getResizeHandler()}
                                    className={`${styles.resizer} ${header.column.getIsResizing() ? styles.isResizing : ''}`}
                                  />
                                )}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                          const row = rows[virtualRow.index]
                          if (!row) return null
                          const rowClasses = [
                            row.original.isInstalled ? 'row-installed' : 'row-not-installed',
                            row.original.hasUpdate ? 'row-update-available' : '',
                            virtualRow.index % 2 === 0 ? 'row-even' : 'row-odd'
                          ].filter(Boolean).join(' ')
                          return (
                            <tr
                              key={row.id}
                              className={rowClasses}
                              style={{
                                position: 'absolute', top: 0, left: 0, width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`
                              }}
                              onClick={(e) => handleRowClick(e, row)}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ════════════ DIALOGS (outside layout) ════════════ */}
      {dialogGame && (
        <GameDetailsDialog
          game={dialogGame}
          open={isDialogOpen}
          onClose={handleCloseDialog}
          downloadStatusMap={downloadStatusMap}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
          onReinstall={handleReinstall}
          onUpdate={handleUpdate}
          onRetry={handleRetry}
          onCancelDownload={handleCancelDownload}
          onDeleteDownloaded={handleDeleteDownloaded}
          onInstallFromCompleted={handleInstallFromCompleted}
          getNote={getNote}
          isConnected={isConnected}
          isBusy={isBusy}
        />
      )}

      <Dialog open={showInstallDialog} onOpenChange={(_, data) => !data.open && closeInstallDialog()}>
        <DialogSurface style={{ background: '#050514', border: '1px solid rgba(57,255,20,0.35)', ['--colorNeutralForeground1' as string]: '#39ff14', ['--colorNeutralForeground2' as string]: 'rgba(57,255,20,0.75)', ['--colorNeutralBackground1' as string]: '#050514' }}>
          <DialogBody>
            <DialogTitle>{t('manualOperation')}</DialogTitle>
            <DialogContent>
              <div style={{ marginBottom: tokens.spacingVerticalM }}>
                <Text>{installStatusMessage}</Text>
              </div>
              {isManualInstalling && (
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM }}>
                  <Spinner size="small" />
                  <Text>{t('processing')}</Text>
                </div>
              )}
              {installSuccess !== null && (
                <div
                  style={{
                    marginTop: tokens.spacingVerticalM,
                    padding: tokens.spacingVerticalS,
                    borderRadius: tokens.borderRadiusMedium,
                    backgroundColor: installSuccess ? tokens.colorPaletteGreenBackground1 : tokens.colorPaletteRedBackground1,
                    color: installSuccess ? tokens.colorPaletteGreenForeground1 : tokens.colorPaletteRedForeground1
                  }}
                >
                  <Text weight="semibold">
                    {installSuccess ? t('operationSuccess') : t('operationFailed')}
                  </Text>
                  {!installSuccess && (
                    <div style={{ marginTop: tokens.spacingVerticalXS }}>
                      <Text size={200}>{t('checkLogs')}</Text>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={closeInstallDialog} disabled={isManualInstalling}>
                {isManualInstalling ? t('processing') : t('close')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {selectedDevice && (
        <AdbShellDialog
          deviceId={selectedDevice}
          isOpen={shellDialogOpen}
          onDismiss={() => setShellDialogOpen(false)}
        />
      )}

      <Dialog open={showMirrorMgmt} onOpenChange={(_, data) => setShowMirrorMgmt(data.open)}>
        <DialogSurface style={{ width: '80vw', maxWidth: '1200px', height: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: '#050514', border: '1px solid rgba(57,255,20,0.35)', ['--colorNeutralForeground1' as string]: '#39ff14', ['--colorNeutralForeground2' as string]: 'rgba(57,255,20,0.75)', ['--colorNeutralBackground1' as string]: '#050514', ['--colorNeutralStroke1' as string]: 'rgba(57,255,20,0.25)', ['--colorBrandBackground' as string]: '#39ff14', ['--colorNeutralForegroundOnBrand' as string]: '#050514' }}>
          <DialogBody style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <DialogTitle style={{ padding: '16px 24px', borderBottom: '1px solid rgba(57,255,20,0.15)' }}>Mirror Management</DialogTitle>
            <DialogContent style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 24px' }}>
              <MirrorManagement />
            </DialogContent>
            <DialogActions style={{ padding: '12px 24px', borderTop: '1px solid rgba(57,255,20,0.15)' }}>
              <Button appearance="secondary" onClick={() => setShowMirrorMgmt(false)}>Close</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={showObbConfirmDialog} onOpenChange={(_, data) => !data.open && handleObbCancelCopy()}>
        <DialogSurface style={{ background: '#050514', border: '1px solid rgba(57,255,20,0.35)', ['--colorNeutralForeground1' as string]: '#39ff14', ['--colorNeutralForeground2' as string]: 'rgba(57,255,20,0.75)', ['--colorNeutralBackground1' as string]: '#050514' }}>
          <DialogBody>
            <DialogTitle>{t('confirmObbCopy')}</DialogTitle>
            <DialogContent>
              <div style={{ marginBottom: tokens.spacingVerticalM }}>
                <Text>
                  {t('obbNoPackageFound')} &quot;{obbFolderToConfirm?.split(/[/\\]/).pop()}&quot;.
                </Text>
                <div style={{ marginTop: tokens.spacingVerticalS }}>
                  <Text>{t('obbCopyConfirm')}</Text>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={handleObbConfirmCopy} disabled={isManualInstalling}>
                {t('copyAnyway')}
              </Button>
              <Button appearance="secondary" onClick={handleObbCancelCopy} disabled={isManualInstalling}>
                {t('cancel')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}

export default GamesView
