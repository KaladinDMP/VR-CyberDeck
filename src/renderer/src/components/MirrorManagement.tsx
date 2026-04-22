import React, { useState } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardPreview,
  Text,
  Badge,
  Textarea,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  MessageBar,
  MessageBarBody,
  Spinner,
  tokens,
  makeStyles,
  shorthands
} from '@fluentui/react-components'
import {
  AddRegular,
  DeleteRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ClockRegular,
  PlayRegular,
  RadioButtonRegular,
  RecordRegular,
  DocumentRegular,
  CloudRegular,
  ChevronDownRegular,
  ChevronUpRegular
} from '@fluentui/react-icons'
import { useMirrors } from '../hooks/useMirrors'
import { useSettings } from '../hooks/useSettings'
import { useLanguage } from '../hooks/useLanguage'
import { Mirror } from '@shared/types'
import ServerConfigSettings from './ServerConfigSettings'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    overflowY: 'auto',
    flex: 1
  },
  mirrorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: tokens.spacingVerticalM
  },
  mirrorCard: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: tokens.shadow8
    }
  },
  activeMirrorCard: {
    ...shorthands.border('2px', 'solid', tokens.colorBrandBackground)
  },
  mirrorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mirrorInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS
  },
  addMirrorSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM
  },
  rcloneSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`
  }
})

const MirrorManagement: React.FC = () => {
  const styles = useStyles()
  const { t } = useLanguage()
  const {
    mirrors,
    isLoading,
    error,
    testingMirrors,
    addMirror,
    removeMirror,
    setActiveMirror,
    clearActiveMirror,
    testMirror,
    testAllMirrors,
    importMirrorFromFile,
    clearError
  } = useMirrors()

  const { serverConfig } = useSettings()

  const [showRcloneSection, setShowRcloneSection] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [configContent, setConfigContent] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const hasPublicConfig = serverConfig.baseUri.length > 0
  const activeMirror = mirrors.find((m) => m.isActive)

  const handleAddMirror = async (): Promise<void> => {
    if (!configContent.trim()) return

    setIsAdding(true)
    try {
      const success = await addMirror(configContent.trim())
      if (success) {
        setConfigContent('')
        setShowAddDialog(false)
      }
    } finally {
      setIsAdding(false)
    }
  }

  const handleImportFromFile = async (): Promise<void> => {
    setIsImporting(true)
    try {
      await importMirrorFromFile()
    } finally {
      setIsImporting(false)
    }
  }

  const handleRemoveMirror = async (id: string): Promise<void> => {
    if (window.confirm(t('confirmRemoveMirror'))) {
      await removeMirror(id)
    }
  }

  const handleSetActive = async (id: string): Promise<void> => {
    await setActiveMirror(id)
  }

  const handleTestMirror = async (id: string): Promise<void> => {
    await testMirror(id)
  }

  const handleTestAll = async (): Promise<void> => {
    await testAllMirrors()
  }

  const getStatusIcon = (mirror: Mirror): React.JSX.Element => {
    if (testingMirrors.has(mirror.id)) {
      return <Spinner size="tiny" />
    }

    switch (mirror.testStatus) {
      case 'success':
        return <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
      case 'failed':
        return <DismissCircleRegular style={{ color: tokens.colorPaletteRedForeground1 }} />
      case 'testing':
        return <Spinner size="tiny" />
      default:
        return <ClockRegular style={{ color: tokens.colorNeutralForeground3 }} />
    }
  }

  const getStatusText = (mirror: Mirror): string => {
    if (testingMirrors.has(mirror.id)) {
      return t('testing')
    }

    switch (mirror.testStatus) {
      case 'success':
        return t('online')
      case 'failed':
        return t('mirrorFailed')
      case 'testing':
        return t('testing')
      default:
        return t('untested')
    }
  }

  const formatLastTested = (date?: Date): string => {
    if (!date) return t('never')
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    )
  }

  const getServerStatusText = (): string => {
    if (activeMirror) {
      return `${t('activeRcloneConfig')} (${activeMirror.name})`
    }
    if (hasPublicConfig) {
      return t('activePublicServer')
    }
    return t('noServerConfigured')
  }

  const getServerStatusColor = (): string => {
    if (activeMirror || hasPublicConfig) {
      return tokens.colorPaletteGreenForeground1
    }
    return tokens.colorNeutralForeground3
  }

  return (
    <div className={styles.container}>
      {/* Top button row: two top-level methods */}
      <div
        style={{
          display: 'flex',
          gap: tokens.spacingHorizontalS,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <ServerConfigSettings />
        <Button
          appearance={showRcloneSection ? 'primary' : 'secondary'}
          icon={<CloudRegular />}
          iconPosition="before"
          onClick={() => setShowRcloneSection((v) => !v)}
        >
          {t('setRcloneConfig')}
          {mirrors.length > 0 ? ` (${mirrors.length})` : ''}
          {showRcloneSection ? (
            <ChevronUpRegular style={{ marginLeft: tokens.spacingHorizontalXS }} />
          ) : (
            <ChevronDownRegular style={{ marginLeft: tokens.spacingHorizontalXS }} />
          )}
        </Button>
      </div>

      {/* Active server method status */}
      <Card>
        <CardPreview>
          <div
            style={{
              padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.spacingHorizontalS
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
              {activeMirror || hasPublicConfig ? (
                <CheckmarkCircleRegular style={{ color: getServerStatusColor(), flexShrink: 0 }} />
              ) : (
                <DismissCircleRegular
                  style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}
                />
              )}
              <Text style={{ color: getServerStatusColor() }}>{getServerStatusText()}</Text>
            </div>
            {activeMirror && hasPublicConfig && (
              <Button
                appearance="subtle"
                size="small"
                icon={<RadioButtonRegular />}
                onClick={() => clearActiveMirror()}
                title="Switch back to public mirror"
              >
                Use Public Mirror
              </Button>
            )}
          </div>
        </CardPreview>
      </Card>

      {error && (
        <MessageBar intent="error" onDismiss={clearError}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {/* Rclone section — only visible when toggled */}
      {showRcloneSection && (
        <div className={styles.rcloneSection}>
          <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' }}>
            <Button
              appearance="secondary"
              icon={<PlayRegular />}
              onClick={handleTestAll}
              disabled={mirrors.length === 0}
            >
              {t('testAll')}
            </Button>
            <Button
              appearance="secondary"
              icon={<DocumentRegular />}
              onClick={handleImportFromFile}
              disabled={isImporting}
            >
              {isImporting ? <Spinner size="tiny" /> : t('importFromFile')}
            </Button>
            <Dialog open={showAddDialog} onOpenChange={(_, data) => setShowAddDialog(data.open)}>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="primary" icon={<AddRegular />}>
                  {t('addMirror')}
                </Button>
              </DialogTrigger>
              <DialogSurface style={{ background: '#050514', border: '1px solid rgba(57,255,20,0.35)', ['--colorNeutralForeground1' as string]: '#39ff14', ['--colorNeutralForeground2' as string]: 'rgba(57,255,20,0.75)', ['--colorNeutralBackground1' as string]: '#050514', ['--colorNeutralStroke1' as string]: 'rgba(57,255,20,0.25)', ['--colorBrandBackground' as string]: '#39ff14', ['--colorNeutralForegroundOnBrand' as string]: '#050514' }}>
                <DialogTitle>{t('addNewMirror')}</DialogTitle>
                <DialogContent className={styles.dialogContent}>
                  <DialogBody>
                    <Text>{t('addMirrorDesc')}</Text>
                    <Textarea
                      placeholder={`Example:
[mirror01]
type = ftp
host = example.com
port = 21
user = username
pass = password`}
                      value={configContent}
                      onChange={(_, data) => setConfigContent(data.value)}
                      rows={8}
                      resize="vertical"
                    />
                  </DialogBody>
                  <DialogActions>
                    <Button
                      appearance="secondary"
                      onClick={() => setShowAddDialog(false)}
                      disabled={isAdding}
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      appearance="primary"
                      onClick={handleAddMirror}
                      disabled={!configContent.trim() || isAdding}
                    >
                      {isAdding ? <Spinner size="tiny" /> : t('addMirror')}
                    </Button>
                  </DialogActions>
                </DialogContent>
              </DialogSurface>
            </Dialog>
          </div>

          {isLoading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: tokens.spacingVerticalXL
              }}
            >
              <Spinner size="medium" label={t('loadingMirrors')} />
            </div>
          ) : mirrors.length === 0 ? (
            <Card>
              <CardPreview>
                <div style={{ padding: tokens.spacingVerticalXL, textAlign: 'center' }}>
                  <Text>{t('noMirrorsConfigured')}</Text>
                </div>
              </CardPreview>
            </Card>
          ) : (
            <div className={styles.mirrorGrid}>
              {mirrors.map((mirror) => (
                <Card
                  key={mirror.id}
                  className={`${styles.mirrorCard} ${mirror.isActive ? styles.activeMirrorCard : ''}`}
                  onClick={() => !mirror.isActive && handleSetActive(mirror.id)}
                >
                  <CardHeader
                    header={
                      <div className={styles.mirrorHeader}>
                        <div className={styles.mirrorInfo}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: tokens.spacingHorizontalXS
                            }}
                          >
                            {mirror.isActive ? (
                              <RecordRegular color={tokens.colorPaletteGreenForeground1} />
                            ) : (
                              <RadioButtonRegular />
                            )}
                            <Text weight="semibold">{mirror.name}</Text>
                          </div>
                          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                            {mirror.config.type}://{mirror.config.host}
                            {mirror.config.port && `:${mirror.config.port}`}
                          </Text>
                        </div>
                        <div className={styles.statusBadge}>
                          {getStatusIcon(mirror)}
                          <Badge
                            appearance="outline"
                            color={
                              mirror.testStatus === 'success'
                                ? 'success'
                                : mirror.testStatus === 'failed'
                                  ? 'danger'
                                  : 'informative'
                            }
                          >
                            {getStatusText(mirror)}
                          </Badge>
                        </div>
                      </div>
                    }
                  />
                  <CardPreview>
                    <div style={{ padding: tokens.spacingVerticalS }}>
                      <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                        {t('lastTested')} {formatLastTested(mirror.lastTested)}
                      </Text>
                      {mirror.testError && (
                        <Text size={100} style={{ color: tokens.colorPaletteRedForeground1 }}>
                          Error: {mirror.testError}
                        </Text>
                      )}
                      <div className={styles.actions}>
                        <Button
                          size="small"
                          appearance="secondary"
                          icon={<PlayRegular />}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTestMirror(mirror.id)
                          }}
                          disabled={testingMirrors.has(mirror.id)}
                        >
                          {t('test')}
                        </Button>
                        <Button
                          size="small"
                          appearance="secondary"
                          icon={<DeleteRegular />}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveMirror(mirror.id)
                          }}
                        >
                          {t('remove')}
                        </Button>
                      </div>
                    </div>
                  </CardPreview>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MirrorManagement
