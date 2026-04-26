import React, { useEffect, useState } from 'react'
import { useAdb } from '../hooks/useAdb'
import { useGames } from '../hooks/useGames'
import { useSettings } from '../hooks/useSettings'

const HackerConsole: React.FC = () => {
  const { isConnected, selectedDeviceDetails } = useAdb()
  const { games } = useGames()
  const { serverConfig } = useSettings()
  const [cursor, setCursor] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setCursor((v) => !v), 600)
    return () => clearInterval(id)
  }, [])

  const hasServer = serverConfig?.baseUri?.length > 0
  const totalGames = games.filter((g) => { const s = String(g.size ?? '').trim(); return s !== '0 MB' && s !== '' }).length
  const installedGames = games.filter((g) => g.isInstalled).length
  const updatesAvailable = games.filter((g) => g.hasUpdate).length
  const deviceName = selectedDeviceDetails?.friendlyModelName ?? null

  const line = (label: string, value: string, ok?: boolean): React.JSX.Element => (
    <div style={{ display: 'flex', gap: '6px' }}>
      <span style={{ color: 'rgba(var(--vrcd-neon-raw),0.5)', minWidth: '42px' }}>{label}</span>
      <span style={{ color: ok === false ? 'rgba(255,68,68,0.95)' : ok === true ? 'var(--vrcd-neon)' : 'rgba(var(--vrcd-neon-raw),0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )

  return (
    <div style={{
      width: '210px',
      minWidth: '210px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '10px 16px',
      fontFamily: 'var(--vrcd-font-mono)',
      fontSize: '12px',
      letterSpacing: '0.04em',
      lineHeight: '1.7',
      borderRight: '1px solid rgba(var(--vrcd-neon-raw),0.12)',
      flexShrink: 0
    }}>
      <div style={{ color: 'rgba(var(--vrcd-neon-raw),0.45)', fontSize: '10px', letterSpacing: '0.14em', marginBottom: '4px' }}>
        // SYS_STATUS
      </div>
      {line('SRV', hasServer ? 'ONLINE' : 'NO_SRC', hasServer)}
      {line('DEV', isConnected && deviceName ? deviceName.toUpperCase().slice(0, 16) : 'OFFLINE', isConnected)}
      {line('LIB', totalGames ? `${totalGames} TITLES` : 'EMPTY')}
      {installedGames > 0 && line('INST', String(installedGames))}
      {updatesAvailable > 0 && line('UPD', `${updatesAvailable} READY`, true)}
      <div style={{ color: 'rgba(var(--vrcd-neon-raw),0.35)', marginTop: '4px', fontSize: '11px' }}>
        {cursor ? '█' : ' '}_
      </div>
    </div>
  )
}

export default HackerConsole
