import React, { useState } from 'react'
import { useDownload } from '../hooks/useDownload'
import { useAdb } from '../hooks/useAdb'
import { DownloadItem } from '@shared/types'
import {
  makeStyles,
  tokens,
  Title2,
  Text,
  Button,
  ProgressBar,
  Image,
  Badge
} from '@fluentui/react-components'
import {
  DeleteRegular,
  DismissRegular as CloseIcon,
  ArrowCounterclockwiseRegular as RetryIcon,
  ArrowDownloadRegular as DownloadInstallIcon,
  BroomRegular as UninstallIcon,
  PauseRegular as PauseIcon,
  PlayRegular as ResumeIcon,
  FolderRegular,
  DeleteDismissRegular,
  DismissCircleRegular as ClearIcon
} from '@fluentui/react-icons'
import { formatDistanceToNow } from 'date-fns'
import placeholderImage from '../assets/images/game-placeholder.png'
import { useGames } from '@renderer/hooks/useGames'
import { useGameDialog } from '@renderer/hooks/useGameDialog'
import { getDeleteOnRemove, getSideloadingDisabled } from '../hooks/useExtrasSettings'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    padding: tokens.spacingHorizontalXXL,
    gap: tokens.spacingVerticalL
  },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: '60px 1fr auto auto', // Thumbnail, Info, Progress/Status, Actions
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`
  },
  thumbnail: {
    width: '60px',
    height: '60px',
    objectFit: 'cover'
  },
  gameInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    cursor: 'pointer'
  },
  gameNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS
  },
  installedBadge: {
    fontSize: tokens.fontSizeBase100
  },
  progressStatus: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: tokens.spacingVerticalXS,
    width: '150px' // Fixed width for progress/status text
  },
  progressBar: {
    width: '100%'
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalXS,
    alignItems: 'flex-end'
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200
  },
  statusText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2
  }
})

interface DownloadsViewProps {
  onClose: () => void
}

const DownloadsView: React.FC<DownloadsViewProps> = ({ onClose }) => {
  const styles = useStyles()
  const { queue, isLoading, error, removeFromQueue, removeFromQueueOnly, cancelDownload, retryDownload, pauseDownload, resumeDownload } = useDownload()
  const { selectedDevice, isConnected, loadPackages } = useAdb()
  const { games } = useGames()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setDialogGame] = useGameDialog()
  const [confirmPending, setConfirmPending] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const formatAddedTime = (timestamp: number): string => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch (e: unknown) {
      console.error('Error formatting date:', e)
      return 'Invalid date'
    }
  }

  const handleInstallFromCompleted = (releaseName: string): void => {
    if (!releaseName || !selectedDevice) {
      console.error('Missing releaseName or selectedDevice for install from completed action')
      window.alert('Cannot start installation: Missing required information.')
      return
    }
    console.log(`Requesting install from completed for ${releaseName} on ${selectedDevice}`)
    window.api.downloads.installFromCompleted(releaseName, selectedDevice).catch((err) => {
      console.error('Error triggering install from completed:', err)
      window.alert('Failed to start installation. Please check the main process logs.')
    })
  }

  const handleUninstall = async (item: DownloadItem): Promise<void> => {
    const game = games.find((g) => g.releaseName === item.releaseName)
    if (!game || !game.packageName || !selectedDevice) {
      console.error('Cannot uninstall: Missing game data, package name, or selected device')
      window.alert('Cannot uninstall: Missing required information.')
      return
    }

    const confirmUninstall = window.confirm(
      `Are you sure you want to uninstall ${game.name} (${game.packageName})? This will remove the app and its data from the device.`
    )

    if (confirmUninstall) {
      console.log(`Uninstalling ${game.packageName} from ${selectedDevice}`)
      try {
        const success = await window.api.adb.uninstallPackage(selectedDevice, game.packageName)
        if (success) {
          console.log('Uninstall successful')
          await loadPackages()
        } else {
          console.error('Uninstall failed')
          window.alert('Failed to uninstall the game.')
        }
      } catch (err) {
        console.error('Error during uninstall:', err)
        window.alert('An error occurred during uninstallation.')
      }
    }
  }

  const handleDeleteButton = (releaseName: string): void => {
    const behavior = getDeleteOnRemove()
    if (behavior === 'delete') {
      removeFromQueue(releaseName)
    } else if (behavior === 'keep') {
      removeFromQueueOnly(releaseName)
    } else {
      // 'ask' — show inline confirmation
      setConfirmPending(releaseName)
    }
  }

  const handleClearCompleted = (): void => {
    queue
      .filter((item) => item.status === 'Completed' || item.status === 'Cancelled')
      .forEach((item) => removeFromQueueOnly(item.releaseName))
  }

  const handleScan = async (): Promise<void> => {
    setIsScanning(true)
    setScanResult(null)
    try {
      const { added, pruned } = await window.api.downloads.scanDownloadFolder()
      setScanResult(`Scan complete: ${added} registered, ${pruned} pruned`)
    } catch {
      setScanResult('Scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  const isInstalled = (releaseName: string): boolean => {
    return games.some((game) => game.releaseName === releaseName && game.isInstalled)
  }

  if (isLoading) {
    return <div className={styles.root}>Loading download queue...</div>
  }

  if (error) {
    return (
      <div className={styles.root}>
        <Title2>Downloads</Title2>
        <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
          Error loading queue: {error}
        </Text>
      </div>
    )
  }

  const sideloadingDisabled = getSideloadingDisabled()

  return (
    <div className={styles.root}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <Button
          size="small"
          appearance="subtle"
          icon={<FolderRegular />}
          onClick={handleScan}
          disabled={isScanning}
          title="Scan downloads folder and register any untracked completed downloads"
          style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(var(--vrcd-neon-raw),0.8)', border: '1px solid rgba(var(--vrcd-neon-raw),0.3)' }}
        >
          {isScanning ? 'Scanning...' : 'Scan Downloads'}
        </Button>
        <Button
          size="small"
          appearance="subtle"
          icon={<ClearIcon />}
          onClick={handleClearCompleted}
          disabled={!queue.some((i) => i.status === 'Completed' || i.status === 'Cancelled')}
          title="Remove all completed and cancelled entries from the list (keeps downloaded files)"
          style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(var(--vrcd-neon-raw),0.8)', border: '1px solid rgba(var(--vrcd-neon-raw),0.3)' }}
        >
          Clear Completed
        </Button>
        {scanResult && (
          <Text size={200} style={{ color: 'rgba(var(--vrcd-neon-raw),0.6)', fontFamily: 'monospace' }}>
            {scanResult}
          </Text>
        )}
      </div>
      {queue.length === 0 ? (
        <Text>Download queue is empty.</Text>
      ) : (
        <div>
          {queue
            .sort((a, b) => b.addedDate - a.addedDate)
            .map((item) => (
              <div key={item.releaseName} className={styles.itemRow}>
                {/* Thumbnail */}
                <Image
                  src={item.thumbnailPath ? `file://${item.thumbnailPath}` : placeholderImage}
                  alt={`${item.gameName} thumbnail`}
                  className={styles.thumbnail}
                  shape="rounded"
                  fit="cover"
                />
                {/* Game Info */}
                <div
                  className={styles.gameInfo}
                  onClick={() => {
                    let gameToOpen = games.find((g) => g.releaseName === item.releaseName)
                    if (!gameToOpen) {
                      console.log('Game not found by release name, trying by package name')
                      gameToOpen = games.find((g) => g.packageName === item.packageName)
                    }
                    if (gameToOpen) {
                      setDialogGame(gameToOpen)
                    }
                    onClose()
                  }}
                >
                  <div className={styles.gameNameRow}>
                    <Text weight="semibold">{item.gameName}</Text>
                    {isInstalled(item.releaseName) && (
                      <Badge
                        appearance="filled"
                        color="success"
                        size="small"
                        className={styles.installedBadge}
                      >
                        Installed
                      </Badge>
                    )}
                  </div>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                    {item.releaseName}
                  </Text>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    Added: {formatAddedTime(item.addedDate)}
                  </Text>
                </div>
                {/* Progress / Status */}
                <div className={styles.progressStatus}>
                  {item.status === 'Downloading' && (
                    <>
                      <ProgressBar value={item.progress / 100} className={styles.progressBar} />
                      <Text className={styles.statusText}>{item.progress}%</Text>
                      {item.speed && (
                        <Text size={200} className={styles.statusText}>
                          Speed: {item.speed}
                        </Text>
                      )}
                      {item.eta &&
                        item.eta !== '-' && ( // Don't show ETA if it's just '-'
                          <Text size={200} className={styles.statusText}>
                            ETA: {item.eta}
                          </Text>
                        )}
                    </>
                  )}
                  {/* Added Extraction Progress Display */}
                  {item.status === 'Extracting' && (
                    <>
                      <ProgressBar
                        value={(item.extractProgress || 0) / 100}
                        className={styles.progressBar}
                      />
                      <Text className={styles.statusText}>
                        Extracting... {item.extractProgress || 0}%
                      </Text>
                    </>
                  )}
                  {item.status === 'Installing' && (
                    <>
                      {(item.progress || 0) < 50 ? (
                        <ProgressBar className={styles.progressBar} />
                      ) : (
                        <ProgressBar
                          value={(item.progress || 0) / 100}
                          className={styles.progressBar}
                        />
                      )}
                      <Text className={styles.statusText}>
                        {(item.progress || 0) < 50 ? 'Installing APK...' : 'Copying OBB...'}
                      </Text>
                    </>
                  )}
                  {item.status === 'Queued' && <Text className={styles.statusText}>Queued</Text>}
                  {item.status === 'Completed' && (
                    <Text style={{ color: tokens.colorPaletteGreenForeground1 }}>Completed</Text>
                  )}
                  {item.status === 'Cancelled' && (
                    <Text className={styles.statusText}>Cancelled</Text>
                  )}
                  {item.status === 'Paused' && (
                    <>
                      <ProgressBar value={item.progress / 100} className={styles.progressBar} />
                      <Text className={styles.statusText}>Paused – {item.progress}%</Text>
                    </>
                  )}
                  {item.status === 'Error' && (
                    <>
                      <Text className={styles.errorText}>
                        {item.error?.toLowerCase().includes('insufficient disk space') ||
                        item.error?.toLowerCase().includes('no space left')
                          ? '💾 Out of disk space'
                          : 'Error'}
                      </Text>
                      {item.error && (
                        <Text
                          size={200}
                          className={styles.errorText}
                          title={item.error}
                          style={
                            item.error.toLowerCase().includes('insufficient disk space') ||
                            item.error.toLowerCase().includes('no space left')
                              ? { whiteSpace: 'normal', wordBreak: 'break-word' }
                              : undefined
                          }
                        >
                          {item.error.toLowerCase().includes('insufficient disk space') ||
                          item.error.toLowerCase().includes('no space left')
                            ? item.error
                            : `${item.error.substring(0, 30)}...`}
                        </Text>
                      )}
                    </>
                  )}
                  {item.status === 'InstallError' && (
                    <>
                      <Text className={styles.errorText}>
                        {item.error?.toLowerCase().includes('insufficient_storage') ||
                        item.error?.toLowerCase().includes('no space left')
                          ? '💾 Out of device storage'
                          : 'Install Error'}
                      </Text>
                      {item.error && (
                        <Text size={200} className={styles.errorText} title={item.error}>
                          {item.error.substring(0, 50)}...
                        </Text>
                      )}
                    </>
                  )}

                  {/* Install/Uninstall Buttons */}
                  {item.status === 'Completed' && !isInstalled(item.releaseName) && !sideloadingDisabled && (
                    <Button
                      icon={<DownloadInstallIcon />}
                      aria-label="Install game"
                      size="small"
                      appearance="primary"
                      onClick={() => handleInstallFromCompleted(item.releaseName)}
                      disabled={!isConnected || !selectedDevice}
                      title={
                        !isConnected || !selectedDevice ? 'Connect a device to install' : 'Install'
                      }
                    >
                      Install
                    </Button>
                  )}

                  {item.status === 'Completed' && isInstalled(item.releaseName) && !sideloadingDisabled && (
                    <Button
                      icon={<UninstallIcon />}
                      aria-label="Uninstall game"
                      size="small"
                      appearance="outline"
                      onClick={() => handleUninstall(item)}
                      disabled={!isConnected || !selectedDevice}
                      title={
                        !isConnected || !selectedDevice
                          ? 'Connect a device to uninstall'
                          : 'Uninstall'
                      }
                    >
                      Uninstall
                    </Button>
                  )}
                </div>
                {/* Actions */}
                <div className={styles.actions}>
                  {/* Pause Button */}
                  {item.status === 'Downloading' && (
                    <Button
                      icon={<PauseIcon />}
                      aria-label="Pause"
                      size="small"
                      appearance="subtle"
                      onClick={() => pauseDownload(item.releaseName)}
                      title="Pause download"
                    />
                  )}

                  {/* Resume Button */}
                  {item.status === 'Paused' && (
                    <Button
                      icon={<ResumeIcon />}
                      aria-label="Resume"
                      size="small"
                      appearance="subtle"
                      onClick={() => resumeDownload(item.releaseName)}
                      title="Resume download"
                    />
                  )}

                  {/* Cancel Button */}
                  {(item.status === 'Queued' ||
                    item.status === 'Downloading' ||
                    item.status === 'Extracting' ||
                    item.status === 'Installing') && (
                    <Button
                      icon={<CloseIcon />}
                      aria-label="Cancel"
                      size="small"
                      appearance="subtle"
                      onClick={() => cancelDownload(item.releaseName)}
                      title="Cancel"
                    />
                  )}

                  {/* Retry Button */}
                  {(item.status === 'Cancelled' ||
                    item.status === 'Error' ||
                    item.status === 'InstallError') && (
                    <Button
                      icon={<RetryIcon />}
                      aria-label="Retry download"
                      size="small"
                      appearance="subtle"
                      onClick={() => retryDownload(item.releaseName)}
                      title="Retry"
                    />
                  )}

                  {/* Remove Button (appears when not actively downloading/extracting/installing) */}
                  {(item.status === 'Completed' ||
                    item.status === 'Cancelled' ||
                    item.status === 'Paused' ||
                    item.status === 'Error' ||
                    item.status === 'InstallError' ||
                    item.status === 'Queued') && (
                    confirmPending === item.releaseName ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                        <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>Delete files too?</Text>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <Button
                            icon={<FolderRegular />}
                            size="small"
                            appearance="subtle"
                            title="Remove from list, keep files"
                            onClick={() => { setConfirmPending(null); removeFromQueueOnly(item.releaseName) }}
                          >Keep</Button>
                          <Button
                            icon={<DeleteDismissRegular />}
                            size="small"
                            appearance="subtle"
                            title="Remove and delete downloaded files"
                            style={{ color: tokens.colorPaletteRedForeground1 }}
                            onClick={() => { setConfirmPending(null); removeFromQueue(item.releaseName) }}
                          >Delete</Button>
                          <Button
                            icon={<CloseIcon />}
                            size="small"
                            appearance="subtle"
                            title="Cancel"
                            onClick={() => setConfirmPending(null)}
                          />
                        </div>
                      </div>
                    ) : (
                      <Button
                        icon={<DeleteRegular />}
                        aria-label="Remove from list"
                        size="small"
                        appearance="subtle"
                        onClick={() => handleDeleteButton(item.releaseName)}
                        title="Remove from list"
                      />
                    )
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default DownloadsView
