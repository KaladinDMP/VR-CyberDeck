import React, { useState, useEffect } from 'react'
import {
  Text,
  Button,
  Input,
  Textarea,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import {
  CheckmarkCircleRegular,
  ServerRegular,
  DismissCircleRegular
} from '@fluentui/react-icons'
import { useSettings } from '../hooks/useSettings'

const useStyles = makeStyles({
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-end'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    flex: 1
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalS
  }
})

const ServerConfigSettings: React.FC = () => {
  const styles = useStyles()
  const { serverConfig, setServerConfig } = useSettings()

  const [open, setOpen] = useState(false)
  const [baseUri, setBaseUri] = useState(serverConfig.baseUri)
  const [password, setPassword] = useState(serverConfig.password)
  const [pastedJson, setPastedJson] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    setBaseUri(serverConfig.baseUri)
    setPassword(serverConfig.password)
  }, [serverConfig.baseUri, serverConfig.password])

  const handleParseJson = (): void => {
    setLocalError(null)
    const trimmed = pastedJson.trim()
    if (!trimmed) {
      setLocalError('Paste a JSON snippet first')
      return
    }
    try {
      const parsed = JSON.parse(trimmed) as { baseUri?: unknown; password?: unknown }
      if (typeof parsed.baseUri !== 'string' || typeof parsed.password !== 'string') {
        setLocalError('JSON must contain string "baseUri" and "password" fields')
        return
      }
      setBaseUri(parsed.baseUri)
      setPassword(parsed.password)
      setPastedJson('')
    } catch (err) {
      console.error('Failed to parse pasted JSON:', err)
      setLocalError('Pasted text is not valid JSON')
    }
  }

  const handleSave = async (): Promise<void> => {
    setLocalError(null)
    setSaveSuccess(false)
    if (!baseUri.trim() || !password.trim()) {
      setLocalError('Both baseUri and password are required')
      return
    }
    try {
      await setServerConfig({ baseUri: baseUri.trim(), password: password.trim() })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Error saving server config:', err)
      setLocalError('Failed to save server configuration')
    }
  }

  const hasConfig = serverConfig.baseUri.length > 0

  return (
    <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <DialogTrigger disableButtonEnhancement>
        <Button appearance="secondary" icon={<ServerRegular />}>
          Set Public Server JSON
        </Button>
      </DialogTrigger>
      <DialogSurface style={{ maxWidth: '600px' }}>
        <DialogTitle>Public Server JSON</DialogTitle>
        <DialogContent>
          <DialogBody
            style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}
          >
            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
              Paste the full JSON or fill in the fields. Credentials are stored locally.
            </Text>

            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS }}>
              <Text size={200} weight="semibold">
                Paste JSON
              </Text>
              <Textarea
                value={pastedJson}
                onChange={(_, data) => setPastedJson(data.value)}
                placeholder='{"baseUri":"https://...","password":"..."}'
                rows={2}
                resize="vertical"
              />
              <Button size="small" onClick={handleParseJson} appearance="subtle">
                Apply JSON to fields
              </Button>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <Text size={200} weight="semibold">
                  Base URI
                </Text>
                <Input
                  value={baseUri}
                  onChange={(_, data) => setBaseUri(data.value)}
                  placeholder="https://your-url-here/"
                />
              </div>
              <div className={styles.field}>
                <Text size={200} weight="semibold">
                  Password
                </Text>
                <Input
                  value={password}
                  onChange={(_, data) => setPassword(data.value)}
                  placeholder="your-password-here"
                  type="password"
                />
              </div>
            </div>

            {localError && (
              <div className={styles.status}>
                <DismissCircleRegular style={{ color: tokens.colorPaletteRedForeground1 }} />
                <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                  {localError}
                </Text>
              </div>
            )}
            {saveSuccess && (
              <div className={styles.status}>
                <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
                <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
                  Saved. Force Sync or restart to use new credentials.
                </Text>
              </div>
            )}
          </DialogBody>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={handleSave}>
              Save
            </Button>
          </DialogActions>
        </DialogContent>
      </DialogSurface>
    </Dialog>
  )
}

export default ServerConfigSettings
