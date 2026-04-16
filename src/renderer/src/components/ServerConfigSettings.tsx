import React, { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  Text,
  Button,
  Input,
  Textarea,
  Subtitle1,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import { CheckmarkCircleRegular, InfoRegular } from '@fluentui/react-icons'
import { useSettings } from '../hooks/useSettings'

const useStyles = makeStyles({
  card: {
    width: '100%',
    boxShadow: tokens.shadow4,
    borderRadius: tokens.borderRadiusMedium
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
    maxWidth: '800px'
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
  }
})

const ServerConfigSettings: React.FC = () => {
  const styles = useStyles()
  const { serverConfig, setServerConfig } = useSettings()

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

  return (
    <Card className={styles.card}>
      <CardHeader description={<Subtitle1 weight="semibold">Server Configuration</Subtitle1>} />
      <div className={styles.cardContent}>
        <Text>
          Paste your full <code>ServerInfo.json</code> snippet below, or fill in the fields
          individually. These credentials are stored locally with your other app settings.
        </Text>

        <div className={styles.formRow} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <Text weight="semibold">Paste JSON</Text>
          <Textarea
            value={pastedJson}
            onChange={(_, data) => setPastedJson(data.value)}
            placeholder='{"baseUri":"https://your-url-here/","password":"your-password-here"}'
            rows={3}
          />
          <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
            <Button onClick={handleParseJson} appearance="secondary">
              Apply JSON to fields
            </Button>
          </div>
        </div>

        <div className={styles.formRow}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              gap: tokens.spacingVerticalXS
            }}
          >
            <Text>Base URI</Text>
            <Input
              className={styles.input}
              value={baseUri}
              onChange={(_, data) => setBaseUri(data.value)}
              placeholder="https://your-url-here/"
              size="large"
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              gap: tokens.spacingVerticalXS
            }}
          >
            <Text>Password</Text>
            <Input
              className={styles.input}
              value={password}
              onChange={(_, data) => setPassword(data.value)}
              placeholder="your-password-here"
              type="password"
              size="large"
            />
          </div>
        </div>

        <div
          className={styles.formRow}
          style={{ justifyContent: 'flex-end', marginTop: tokens.spacingVerticalM }}
        >
          <Button onClick={handleSave} appearance="primary" size="large">
            Save Server Config
          </Button>
        </div>

        {localError && <Text className={styles.error}>{localError}</Text>}
        {saveSuccess && (
          <Text className={styles.success}>
            <CheckmarkCircleRegular />
            Server configuration saved. Resync game data or restart the app to use the new
            credentials.
          </Text>
        )}

        <Text className={styles.hint}>
          <InfoRegular />
          After saving, go to the games view and press Force Sync (or restart the app) to pick up
          the new server credentials.
        </Text>
      </div>
    </Card>
  )
}

export default ServerConfigSettings
