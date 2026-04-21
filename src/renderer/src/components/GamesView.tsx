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
  Title3,
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
  StorageRegular,
  PersonRegular,
  EditRegular,
  FolderAddRegular,
  DocumentRegular,
  ChevronDownRegular,
  CopyRegular,
  WindowConsoleRegular,
  OptionsRegular
} from '@fluentui/react-icons'
import { ArrowLeftRegular } from '@fluentui/react-icons'
import GameDetailsDialog from './GameDetailsDialog'
import { useGameDialog } from '@renderer/hooks/useGameDialog'
import MirrorSelector from './MirrorSelector'
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
    height: 'calc(100vh - 90px)',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1
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
  }
})

interface GamesViewProps {
  onBackToDevices: () => void
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

const GamesView: React.FC<GamesViewProps> = ({ onBackToDevices }) => {
  const {
    selectedDevice,
    selectedDeviceDetails,
    isConnected,
    disconnectDevice,
    isLoading: adbLoading,
    loadPackages,
    userName,
    loadingUserName,
    setUserName
  } = useAdb()
  const {
    games,
    isLoading: loadingGames,
    error: gamesError,
    lastSyncTime,
    downloadProgress,
    extractProgress,
    refreshGames,
    getNote
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
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [dialogGame, setDialogGame] = useGameDialog()
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [tableWidth, setTableWidth] = useState<number>(0)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [isEditingUserName, setIsEditingUserName] = useState<boolean>(false)
  const [editUserNameValue, setEditUserNameValue] = useState<string>('')
  const [isManualInstalling, setIsManualInstalling] = useState<boolean>(false)
  const [installStatusMessage, setInstallStatusMessage] = useState<string>('')
  const [showInstallDialog, setShowInstallDialog] = useState<boolean>(false)
  const [installSuccess, setInstallSuccess] = useState<boolean | null>(null)
  const [showObbConfirmDialog, setShowObbConfirmDialog] = useState<boolean>(false)
  const [obbFolderToConfirm, setObbFolderToConfirm] = useState<string | null>(null)

  const counts = useMemo(() => {
    const total = games.length
    const installed = games.filter((g) => g.isInstalled).length
    const updates = games.filter((g) => g.hasUpdate).length
    return { total, installed, updates }
  }, [games])

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
    return games.filter((game) => {
      const size = String(game.size ?? '').trim()
      return size !== '0 MB' && size !== ''
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
    onSortingChange: setSorting,
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

  const handleEditUserName = useCallback(() => {
    setEditUserNameValue(userName)
    setIsEditingUserName(true)
  }, [userName])

  const handleSaveUserName = useCallback(async () => {
    if (!editUserNameValue.trim()) return

    try {
      await setUserName(editUserNameValue.trim())
      setIsEditingUserName(false)
    } catch (error) {
      console.error('Error setting user name:', error)
      window.alert('Failed to set user name. Please try again.')
    }
  }, [editUserNameValue, setUserName])

  const handleCancelEditUserName = useCallback(() => {
    setIsEditingUserName(false)
    setEditUserNameValue('')
  }, [])

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

  const isBusy = adbLoading || loadingGames || isLoading || isManualInstalling

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={onBackToDevices}>
            {t('devicesSelection')}
          </Button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
              <Title3>{selectedDeviceDetails?.friendlyModelName || t('games')}</Title3>
              {selectedDeviceDetails && (
                <>
                  {selectedDeviceDetails?.batteryLevel !== null && (
                    <Badge
                      appearance="outline"
                      color={selectedDeviceDetails.batteryLevel > 20 ? 'success' : 'danger'}
                      icon={<BatteryChargeRegular />}
                    >
                      {selectedDeviceDetails.batteryLevel}%
                    </Badge>
                  )}
                  {selectedDeviceDetails?.storageFree && (
                    <Badge appearance="outline" icon={<StorageRegular />}>
                      {selectedDeviceDetails.storageFree} free
                    </Badge>
                  )}
                </>
              )}
            </div>
            {isConnected && (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}
              >
                {isEditingUserName ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacingHorizontalXS
                    }}
                  >
                    <Input
                      value={editUserNameValue}
                      onChange={(e) => setEditUserNameValue(e.target.value)}
                      placeholder={t('enterVrName')}
                      size="small"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveUserName()
                        } else if (e.key === 'Escape') {
                          handleCancelEditUserName()
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      appearance="subtle"
                      size="small"
                      onClick={handleSaveUserName}
                      disabled={loadingUserName || !editUserNameValue.trim()}
                    >
                      {loadingUserName ? <Spinner size="tiny" /> : t('save')}
                    </Button>
                    <Button
                      appearance="subtle"
                      size="small"
                      onClick={handleCancelEditUserName}
                      disabled={loadingUserName}
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacingHorizontalXS
                    }}
                  >
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                      {t('usernameInGames')}
                    </Text>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<PersonRegular />}
                      iconPosition="before"
                      onClick={handleEditUserName}
                      style={{
                        minHeight: 'auto',
                        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
                        borderRadius: tokens.borderRadiusMedium,
                        border: `1px solid ${tokens.colorNeutralStroke2}`,
                        backgroundColor: tokens.colorNeutralBackground1
                      }}
                      title={t('enterVrName')}
                    >
                      {userName || t('clickToSet')}
                      <EditRegular
                        style={{ marginLeft: tokens.spacingHorizontalXS, fontSize: '12px' }}
                      />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacingVerticalS,
            alignItems: 'flex-end'
          }}
        >
          <MirrorSelector />
          {isConnected ? (
            <div className={styles.toolbarRight}>
              <Text className={styles.connectedDeviceText}>
                <CheckmarkCircleRegular />
                {t('connectedTo')} {selectedDevice}
              </Text>
              <Button
                appearance="subtle"
                icon={<WindowConsoleRegular />}
                onClick={() => setShellDialogOpen(true)}
                title="Open ADB shell"
              />
              <Button
                appearance="subtle"
                icon={<PlugDisconnectedRegular />}
                onClick={disconnectDevice}
                title={t('disconnectFromDevice')}
              />
            </div>
          ) : (
            <div className={styles.toolbarRight}>
              <Text className={styles.deviceWarningText}>
                <DismissRegular />
                {t('notConnectedToDevice')}
              </Text>
            </div>
          )}
        </div>
      </div>

      <div className={styles.tableContainer}>
        <div className="games-toolbar">
          <div className="games-toolbar-left">
            <Button icon={<ArrowClockwiseRegular />} onClick={refreshGames} disabled={isBusy}>
              {isBusy ? t('working') : t('refreshGames')}
            </Button>
            <Button
              icon={<ArrowClockwiseRegular />}
              onClick={() => loadPackages()}
              disabled={isBusy || !isConnected}
              title={
                !isConnected
                  ? t('connectDeviceToRefresh')
                  : t('refreshInstalledPackages')
              }
            >
              {isBusy ? t('working') : t('refreshQuest')}
            </Button>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  icon={<FolderAddRegular />}
                  iconPosition="before"
                  disabled={isBusy || !isConnected}
                  title={
                    !isConnected
                      ? t('connectDeviceInstall')
                      : t('installApkOrFolder')
                  }
                >
                  {isManualInstalling ? t('manualInstalling') : t('manualInstall')}
                  <ChevronDownRegular />
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<DocumentRegular />}
                    onClick={() => handleManualInstall('apk')}
                    disabled={isManualInstalling}
                  >
                    {t('installApkFile')}
                  </MenuItem>
                  <MenuItem
                    icon={<FolderAddRegular />}
                    onClick={() => handleManualInstall('folder')}
                    disabled={isManualInstalling}
                  >
                    {t('installFolder')}
                  </MenuItem>
                  <MenuItem
                    icon={<CopyRegular />}
                    onClick={handleCopyObbFolder}
                    disabled={isManualInstalling}
                  >
                    {t('copyObbFolder')}
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
            <span className="last-synced">{t('lastSynced')} {formatDate(lastSyncTime)}</span>
            {isConnected && (
              <div className="filter-buttons">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={activeFilter === 'all' ? 'active' : ''}
                >
                  {t('filterAll')} ({counts.total})
                </button>
                <button
                  onClick={() => setActiveFilter('installed')}
                  className={activeFilter === 'installed' ? 'active' : ''}
                >
                  {t('filterInstalled')} ({counts.installed})
                </button>
                <button
                  onClick={() => setActiveFilter('update')}
                  className={activeFilter === 'update' ? 'active' : ''}
                  disabled={counts.updates === 0}
                >
                  {t('filterUpdates')} ({counts.updates})
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="games-toolbar-right">
          <span className="game-count">{table.getFilteredRowModel().rows.length} {t('displayed')}</span>

          {/* ── View Options popover ────────────────────────────────────── */}
          <Popover
            open={viewOptionsOpen}
            onOpenChange={(_, d) => setViewOptionsOpen(d.open)}
          >
            <PopoverTrigger disableButtonEnhancement>
              <Button appearance="subtle" icon={<OptionsRegular />} title="View options" />
            </PopoverTrigger>
            <PopoverSurface style={{ padding: '16px', minWidth: '300px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Density slider */}
                <div>
                  <Text size={200} weight="semibold" style={{ display: 'block', marginBottom: '6px' }}>
                    Row density
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>Compact</Text>
                    <Slider
                      style={{ flex: 1 }}
                      min={0} max={100} step={5}
                      value={prefs.rowDensity}
                      onChange={(_, d) => setPrefs({ rowDensity: d.value })}
                    />
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>Comfortable</Text>
                  </div>
                </div>

                {/* Alternating rows toggle */}
                <Switch
                  label="Alternating row colours"
                  checked={prefs.alternatingRows}
                  onChange={(_, d) => setPrefs({ alternatingRows: d.checked })}
                />

                {/* Colour pickers – shown only when alternating is on */}
                {prefs.alternatingRows && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(
                      [
                        { label: 'Even rows', key: 'evenRowColor' as const },
                        { label: 'Odd rows',  key: 'oddRowColor'  as const },
                      ] as const
                    ).map(({ label, key }) => (
                      <div key={key}>
                        <Text size={200} style={{ display: 'block', marginBottom: '6px', color: tokens.colorNeutralForeground2 }}>
                          {label}
                        </Text>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {COLOR_SWATCHES.map((sw) => (
                            <div
                              key={sw.label}
                              title={sw.label}
                              style={{
                                width: '22px', height: '22px',
                                borderRadius: '4px',
                                background: sw.value === 'transparent'
                                  ? 'repeating-linear-gradient(45deg,#777 0,#777 2px,transparent 0,transparent 50%) 0 0/8px 8px'
                                  : sw.value,
                                cursor: 'pointer',
                                boxSizing: 'border-box',
                                border: prefs[key] === sw.value
                                  ? '2px solid #00d4ff'
                                  : '2px solid rgba(255,255,255,0.18)',
                              }}
                              onClick={() => setPrefs({ [key]: sw.value })}
                            />
                          ))}
                          {/* Custom colour picker */}
                          <input
                            type="color"
                            title="Custom colour"
                            style={{
                              width: '22px', height: '22px',
                              padding: 0, border: '2px solid rgba(255,255,255,0.18)',
                              borderRadius: '4px', cursor: 'pointer',
                              background: 'none',
                            }}
                            onChange={(e) => setPrefs({ [key]: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </PopoverSurface>
          </Popover>
          {/* ───────────────────────────────────────────────────────────── */}

          <Input
            value={searchInput}
            onChange={handleSearchChange}
            placeholder={t('searchPlaceholder')}
            type="search"
          />
        </div>
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

        {loadingGames ? (
          <div className="loading-indicator">{t('loadingGamesLibrary')}</div>
        ) : gamesError ? (
          <div className="error-message">{gamesError}</div>
        ) : games.length === 0 && !loadingGames ? (
          <div className="no-games-message">{t('noGamesFound')}</div>
        ) : (
          <>
            <div className={`table-wrapper${prefs.alternatingRows ? ' alternating-rows' : ''}`} ref={tableContainerRef}>
              <table className="games-table" style={{ width: table.getTotalSize() }}>
                <thead
                  style={{
                    display: 'grid',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}
                >
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          colSpan={header.colSpan}
                          style={{ width: header.getSize(), position: 'relative' }}
                        >
                          {header.isPlaceholder ? null : (
                            <div
                              {...{
                                className: header.column.getCanSort()
                                  ? 'cursor-pointer select-none'
                                  : '',
                                onClick: header.column.getToggleSortingHandler()
                              }}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {{
                                asc: ' 🔼',
                                desc: ' 🔽'
                              }[header.column.getIsSorted() as string] ?? null}
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
                <tbody
                  style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index] as Row<GameInfo>
                    const rowClasses = [
                      row.original.isInstalled ? 'row-installed' : 'row-not-installed',
                      row.original.hasUpdate ? 'row-update-available' : '',
                      virtualRow.index % 2 === 0 ? 'row-even' : 'row-odd'
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <tr
                        key={row.id}
                        className={rowClasses}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`
                        }}
                        onClick={(e) => handleRowClick(e, row)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            style={{
                              width: cell.column.getSize(),
                              maxWidth: cell.column.getSize()
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

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

            {/* Manual Installation Progress Dialog */}
            <Dialog
              open={showInstallDialog}
              onOpenChange={(_, data) => !data.open && closeInstallDialog()}
            >
              <DialogSurface>
                <DialogBody>
                  <DialogTitle>{t('manualOperation')}</DialogTitle>
                  <DialogContent>
                    <div style={{ marginBottom: tokens.spacingVerticalM }}>
                      <Text>{installStatusMessage}</Text>
                    </div>
                    {isManualInstalling && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: tokens.spacingHorizontalS,
                          marginBottom: tokens.spacingVerticalM
                        }}
                      >
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
                          backgroundColor: installSuccess
                            ? tokens.colorPaletteGreenBackground1
                            : tokens.colorPaletteRedBackground1,
                          color: installSuccess
                            ? tokens.colorPaletteGreenForeground1
                            : tokens.colorPaletteRedForeground1
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
                    <Button
                      appearance="primary"
                      onClick={closeInstallDialog}
                      disabled={isManualInstalling}
                    >
                      {isManualInstalling ? t('processing') : t('close')}
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>

            {/* ADB Shell dialog */}
            {selectedDevice && (
              <AdbShellDialog
                deviceId={selectedDevice}
                isOpen={shellDialogOpen}
                onDismiss={() => setShellDialogOpen(false)}
              />
            )}

            {/* OBB Folder Confirmation Dialog */}
            <Dialog
              open={showObbConfirmDialog}
              onOpenChange={(_, data) => !data.open && handleObbCancelCopy()}
            >
              <DialogSurface>
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
                    <Button
                      appearance="primary"
                      onClick={handleObbConfirmCopy}
                      disabled={isManualInstalling}
                    >
                      {t('copyAnyway')}
                    </Button>
                    <Button
                      appearance="secondary"
                      onClick={handleObbCancelCopy}
                      disabled={isManualInstalling}
                    >
                      {t('cancel')}
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>
          </>
        )}
      </div>
    </div>
  )
}

export default GamesView
