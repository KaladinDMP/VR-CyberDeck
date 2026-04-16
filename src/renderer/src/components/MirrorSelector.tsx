import React, { useState } from 'react'
import {
  Button,
  Dropdown,
  Option,
  Spinner,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  Text,
  tokens,
  makeStyles
} from '@fluentui/react-components'
import {
  ServerRegular,
  SettingsRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ClockRegular,
  PlayRegular
} from '@fluentui/react-icons'
import { useMirrors } from '../hooks/useMirrors'
import MirrorManagement from './MirrorManagement'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS
  },
  mirrorSelector: {
    minWidth: '200px'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS
  },
  managementDialog: {
    width: '80vw',
    maxWidth: '1200px',
    height: '80vh',
    display: 'flex',
    flexDirection: 'column'
  }
})

const MirrorSelector: React.FC = () => {
  const styles = useStyles()
  const {
    mirrors,
    activeMirror,
    isLoading,
    testingMirrors,
    setActiveMirror,
    clearActiveMirror,
    testMirror
  } = useMirrors()

  const [showManagement, setShowManagement] = useState(false)

  const handleMirrorChange = async (mirrorId: string): Promise<void> => {
    if (mirrorId === 'public') {
      // For public mirror, clear the active mirror
      await clearActiveMirror()
      return
    }
    await setActiveMirror(mirrorId)
  }

  const handleTestMirror = async (): Promise<void> => {
    if (activeMirror) {
      await testMirror(activeMirror.id)
    }
  }

  const getStatusIcon = (): React.JSX.Element => {
    if (!activeMirror) {
      return <ServerRegular />
    }

    if (testingMirrors.has(activeMirror.id)) {
      return <Spinner size="tiny" />
    }

    switch (activeMirror.testStatus) {
      case 'success':
        return <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
      case 'failed':
        return <DismissCircleRegular style={{ color: tokens.colorPaletteRedForeground1 }} />
      default:
        return <ClockRegular style={{ color: tokens.colorNeutralForeground3 }} />
    }
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Spinner size="tiny" />
        <Text>Loading mirrors...</Text>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {getStatusIcon()}
      <Dropdown
        className={styles.mirrorSelector}
        value={activeMirror?.name || 'Public Mirror'}
        selectedOptions={[activeMirror?.id || 'public']}
        button={{ children: activeMirror?.name || 'Public Mirror' }}
        onOptionSelect={(_, data) => {
          if (data.optionValue) {
            handleMirrorChange(data.optionValue)
          }
        }}
        placeholder="Select mirror..."
      >
        <Option value="public" text="Public Mirror">
          Public Mirror
        </Option>
        {mirrors.map((mirror) => (
          <Option key={mirror.id} value={mirror.id} text={mirror.name}>
            {mirror.name}
          </Option>
        ))}
      </Dropdown>

      {activeMirror && (
        <Button
          appearance="subtle"
          size="small"
          icon={<PlayRegular />}
          onClick={handleTestMirror}
          disabled={testingMirrors.has(activeMirror.id)}
          title="Test mirror connectivity"
        >
          Test
        </Button>
      )}

      <Dialog open={showManagement} onOpenChange={(_, data) => setShowManagement(data.open)}>
        <DialogTrigger disableButtonEnhancement>
          <Button
            appearance="subtle"
            size="small"
            icon={<SettingsRegular />}
            title="Manage mirrors"
          >
            Manage
          </Button>
        </DialogTrigger>
        <DialogSurface className={styles.managementDialog}>
          <DialogTitle>Mirror Management</DialogTitle>
          <DialogContent style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DialogBody style={{ flex: 1, overflow: 'hidden' }}>
              <MirrorManagement />
            </DialogBody>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setShowManagement(false)}>
                Close
              </Button>
            </DialogActions>
          </DialogContent>
        </DialogSurface>
      </Dialog>
    </div>
  )
}

export default MirrorSelector
