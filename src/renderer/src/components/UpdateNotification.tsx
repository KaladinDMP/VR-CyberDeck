import React, { useEffect, useState } from 'react'
import { marked } from 'marked'
import {
  Button,
  Text,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Spinner,
  ProgressBar,
  makeStyles,
  tokens,
  TabList,
  Tab,
  TabValue
} from '@fluentui/react-components'
import { UpdateInfo, UpdateProgressInfo } from '@shared/types'
import { ArrowDownloadRegular, CheckmarkCircleRegular, CodeRegular, DocumentTextRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  updateContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM
  },
  releaseInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM
  },
  highlightVersion: {
    fontWeight: 'bold',
    color: tokens.colorBrandForeground1
  },
  spinnerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS
  },
  contentWithIcon: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM
  },
  icon: {
    fontSize: '24px',
    color: tokens.colorBrandForeground1
  },
  tabContent: {
    marginTop: tokens.spacingVerticalM,
    height: '300px',
    overflowY: 'auto'
  },
  commitList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS
  },
  commitItem: {
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  commitHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalXS
  },
  commitSha: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '2px 6px',
    borderRadius: tokens.borderRadiusSmall
  },
  commitMessage: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground1,
    marginBottom: tokens.spacingVerticalXS
  },
  commitMeta: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  commitLink: {
    color: tokens.colorBrandForeground1,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline'
    }
  },
  releaseNotes: {
    maxHeight: '300px',
    overflowY: 'auto',
    '& h1, & h2, & h3': {
      margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalXS}`,
      color: tokens.colorNeutralForeground1,
      fontWeight: tokens.fontWeightSemibold
    },
    '& h2': { fontSize: tokens.fontSizeBase500 },
    '& h3': { fontSize: tokens.fontSizeBase400 },
    '& ul, & ol': {
      paddingLeft: tokens.spacingHorizontalXL,
      margin: `${tokens.spacingVerticalXS} 0`
    },
    '& li': { marginBottom: tokens.spacingVerticalXS },
    '& a': {
      color: tokens.colorBrandForeground1,
      textDecoration: 'none',
      '&:hover': { textDecoration: 'underline' }
    },
    '& p': { margin: `${tokens.spacingVerticalXS} 0` },
    '& code': {
      fontFamily: 'monospace',
      fontSize: tokens.fontSizeBase200,
      backgroundColor: tokens.colorNeutralBackground3,
      padding: '1px 4px',
      borderRadius: tokens.borderRadiusSmall
    },
    '& hr': { border: 'none', borderTop: `1px solid ${tokens.colorNeutralStroke2}`, margin: `${tokens.spacingVerticalS} 0` }
  },
  downloadProgress: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium
  },
  downloadDone: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    color: tokens.colorStatusSuccessForeground1
  }
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UpdateNotification(): React.ReactElement | null {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null)
  const [updateError, setUpdateError] = useState<Error | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState<TabValue>('release-notes')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgressInfo | null>(null)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const styles = useStyles()

  useEffect(() => {
    const removeCheckingListener = window.api.updates?.onCheckingForUpdate?.(() => {
      setIsChecking(true)
      setUpdateError(null)
    })

    const removeAvailableListener = window.api.updates?.onUpdateAvailable?.((info) => {
      setUpdateAvailable(info)
      setIsChecking(false)
      setIsDialogOpen(true)
      setSelectedTab(info.commits && info.commits.length > 0 ? 'commits' : 'release-notes')

      // If a direct asset URL is available, kick off the download automatically
      if (info.assetUrl) {
        setIsDownloading(true)
        setDownloadProgress(null)
        setIsDownloaded(false)
        window.api.updates?.startDownload?.()
      }
    })

    const removeErrorListener = window.api.updates?.onUpdateError?.((error) => {
      setUpdateError(error)
      setIsChecking(false)
      setIsDownloading(false)
    })

    const removeProgressListener = window.api.updates?.onDownloadProgress?.((progress) => {
      setDownloadProgress(progress)
      if (progress.percent >= 100) {
        setIsDownloading(false)
      }
    })

    const removeDownloadedListener = window.api.updates?.onUpdateDownloaded?.(() => {
      setIsDownloaded(true)
      setIsDownloading(false)
    })

    return () => {
      removeCheckingListener?.()
      removeAvailableListener?.()
      removeErrorListener?.()
      removeProgressListener?.()
      removeDownloadedListener?.()
    }
  }, [])

  const handleCheckForUpdates = async (): Promise<void> => {
    try {
      setIsChecking(true)
      await window.api.updates?.checkForUpdates?.()
    } catch (error) {
      console.error('Failed to check for updates:', error)
      setIsChecking(false)
    }
  }

  const handleInstallAndRestart = (): void => {
    window.api.updates?.installUpdate?.()
  }

  const handleOpenReleasePage = (): void => {
    if (updateAvailable?.downloadUrl) {
      window.api.updates?.openDownloadPage?.(updateAvailable.downloadUrl)
    }
    setIsDialogOpen(false)
  }

  const handleDismiss = (): void => {
    setIsDialogOpen(false)
  }

  const formatCommitDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!updateAvailable && !isChecking && !updateError) {
    return null
  }

  let dialogTitle = 'Update Check'
  let dialogContent: React.ReactNode = null

  if (isChecking) {
    dialogTitle = 'Checking for Updates'
    dialogContent = (
      <div className={styles.spinnerContainer}>
        <Spinner size="tiny" />
        <Text>Checking for the latest version...</Text>
      </div>
    )
  } else if (updateError) {
    dialogTitle = 'Update Error'
    dialogContent = (
      <div className={styles.updateContent}>
        <Text>Failed to check for updates: {updateError.message}</Text>
      </div>
    )
  } else if (updateAvailable) {
    dialogTitle = "There's a new update"

    const hasCommits = updateAvailable.commits && updateAvailable.commits.length > 0
    const hasReleaseNotes =
      updateAvailable.releaseNotes && updateAvailable.releaseNotes.trim().length > 0
    const hasAsset = !!updateAvailable.assetUrl

    dialogContent = (
      <div className={styles.updateContent}>
        <div className={styles.releaseInfo}>
          <Text size="large">
            Version{' '}
            <span className={styles.highlightVersion}>{updateAvailable.version}</span> is available.
          </Text>

          {updateAvailable.releaseDate && (
            <Text size="small">
              Released: {new Date(updateAvailable.releaseDate).toLocaleDateString()}
            </Text>
          )}
        </div>

        {/* Download progress area */}
        {hasAsset && (isDownloading || isDownloaded || downloadProgress) && (
          <div className={styles.downloadProgress}>
            {isDownloaded ? (
              <div className={styles.downloadDone}>
                <CheckmarkCircleRegular />
                <Text weight="semibold">Download complete — ready to install.</Text>
              </div>
            ) : (
              <>
                <div className={styles.spinnerContainer}>
                  <Spinner size="tiny" />
                  <Text weight="semibold">Downloading update...</Text>
                </div>
                <ProgressBar value={downloadProgress ? downloadProgress.percent / 100 : 0} />
                {downloadProgress && (
                  <Text size="small" style={{ color: tokens.colorNeutralForeground3 }}>
                    {formatBytes(downloadProgress.transferred)}
                    {downloadProgress.total > 0 ? ` / ${formatBytes(downloadProgress.total)}` : ''}
                    {downloadProgress.bytesPerSecond > 0
                      ? `  •  ${formatBytes(downloadProgress.bytesPerSecond)}/s`
                      : ''}
                    {'  •  '}
                    {downloadProgress.percent.toFixed(1)}%
                  </Text>
                )}
              </>
            )}
          </div>
        )}

        {/* Release notes / commits tabs */}
        {(hasReleaseNotes || hasCommits) && (
          <>
            <TabList
              selectedValue={selectedTab}
              onTabSelect={(_, data) => setSelectedTab(data.value)}
            >
              {hasReleaseNotes && (
                <Tab value="release-notes" icon={<DocumentTextRegular />}>
                  Release Notes
                </Tab>
              )}
              {hasCommits && (
                <Tab value="commits" icon={<CodeRegular />}>
                  Changelog ({updateAvailable.commits?.length || 0} commits)
                </Tab>
              )}
            </TabList>

            <div className={styles.tabContent}>
              {selectedTab === 'release-notes' && hasReleaseNotes && (
                <div
                  className={styles.releaseNotes}
                  dangerouslySetInnerHTML={{
                    __html: marked(updateAvailable.releaseNotes || '', { breaks: true }) as string
                  }}
                />
              )}

              {selectedTab === 'commits' && hasCommits && (
                <div className={styles.commitList}>
                  {updateAvailable.commits?.map((commit) => (
                    <div key={commit.sha} className={styles.commitItem}>
                      <div className={styles.commitHeader}>
                        <span className={styles.commitSha}>{commit.sha}</span>
                      </div>
                      <div className={styles.commitMessage}>{commit.message}</div>
                      <div className={styles.commitMeta}>
                        <span>by {commit.author}</span>
                        <span>
                          {formatCommitDate(commit.date)} •{' '}
                          <a
                            href="#"
                            className={styles.commitLink}
                            onClick={(e) => {
                              e.preventDefault()
                              window.api.updates?.openDownloadPage?.(commit.url)
                            }}
                          >
                            View commit
                          </a>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Fallback link when no direct asset available */}
        {!hasAsset && (
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e0e0e0' }}>
            <Text size="small" style={{ color: '#666' }}>
              No direct download found for your platform. Visit the{' '}
              <Button
                appearance="transparent"
                size="small"
                onClick={handleOpenReleasePage}
                style={{ padding: '0', height: 'auto', minHeight: 'auto' }}
              >
                latest release page
              </Button>{' '}
              to download manually.
            </Text>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={(_, { open }) => setIsDialogOpen(open)}>
      <DialogSurface style={{ minWidth: '600px', maxWidth: '800px' }}>
        <DialogBody>
          <DialogTitle>
            <span style={{ marginRight: '8px' }}>
              {updateAvailable ? (
                <ArrowDownloadRegular style={{ fontSize: '24px', color: tokens.colorBrandForeground1 }} />
              ) : updateError ? (
                <Badge appearance="filled" color="danger">Error</Badge>
              ) : null}
            </span>
            {dialogTitle}
          </DialogTitle>

          <DialogContent>{dialogContent}</DialogContent>

          <DialogActions>
            {updateError ? (
              <>
                <Button appearance="secondary" onClick={handleDismiss}>Dismiss</Button>
                <Button appearance="primary" onClick={handleCheckForUpdates}>Try Again</Button>
              </>
            ) : updateAvailable ? (
              <>
                <Button appearance="secondary" onClick={handleDismiss}>
                  {isDownloaded ? 'Later' : 'Remind Me Later'}
                </Button>
                {isDownloaded ? (
                  <Button
                    appearance="primary"
                    onClick={handleInstallAndRestart}
                    icon={<CheckmarkCircleRegular />}
                  >
                    Install &amp; Restart
                  </Button>
                ) : !updateAvailable.assetUrl ? (
                  <Button
                    appearance="primary"
                    onClick={handleOpenReleasePage}
                    icon={<ArrowDownloadRegular />}
                  >
                    Open Latest Release
                  </Button>
                ) : null}
              </>
            ) : (
              <Button appearance="secondary" onClick={handleDismiss}>Close</Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
