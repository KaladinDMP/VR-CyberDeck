import React from 'react'
import { useAdb } from '../hooks/useAdb'
import { useGames } from '../hooks/useGames'
import { useSettings } from '../hooks/useSettings'

const HackerConsole: React.FC = () => {
  const { isConnected, selectedDeviceDetails } = useAdb()
  const { games } = useGames()
  const { serverConfig } = useSettings()

  const hasServer = serverConfig?.baseUri?.length > 0
  const totalGames = games.filter((g) => { const s = String(g.size ?? '').trim(); return s !== '0 MB' && s !== '' }).length
  const installedGames = games.filter((g) => g.isInstalled).length
  const updatesAvailable = games.filter((g) => g.hasUpdate).length
  const deviceName = selectedDeviceDetails?.friendlyModelName ?? null

  const line = (label: string, value: string, ok?: boolean): React.JSX.Element => (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
      <span style={{ color: 'rgba(var(--vrcd-neon-raw),0.75)', minWidth: '38px' }}>{label}</span>
      <span style={{ color: ok === false ? '#ff6666' : ok === true ? 'var(--vrcd-neon)' : 'var(--vrcd-neon)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700, textShadow: '0 0 6px rgba(var(--vrcd-neon-raw),0.4)' }}>
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
      padding: '4px 16px',
      fontFamily: 'var(--vrcd-font-mono)',
      fontSize: '11px',
      letterSpacing: '0.04em',
      lineHeight: '1.4',
      borderRight: '1px solid rgba(var(--vrcd-neon-raw),0.12)',
      flexShrink: 0,
      overflow: 'hidden'
    }}>
      {line('SRV', hasServer ? 'ONLINE' : 'NO_SRC', hasServer)}
      {line('DEV', isConnected && deviceName ? deviceName.toUpperCase().slice(0, 16) : 'OFFLINE', isConnected)}
      {line('LIB', totalGames ? `${totalGames} TITLES` : 'EMPTY')}
      {installedGames > 0 && line('INST', String(installedGames))}
      {updatesAvailable > 0 && line('UPD', `${updatesAvailable} READY`, true)}
    </div>
  )
}

export default HackerConsole
