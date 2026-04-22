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
  const totalGames = games.length
  const installedGames = games.filter((g) => g.isInstalled).length
  const updatesAvailable = games.filter((g) => g.hasUpdate).length
  const deviceName = selectedDeviceDetails?.friendlyModelName ?? null

  const line = (label: string, value: string, ok?: boolean): React.JSX.Element => (
    <div style={{ display: 'flex', gap: '4px' }}>
      <span style={{ color: 'rgba(57,255,20,0.35)', minWidth: '36px' }}>{label}</span>
      <span style={{ color: ok === false ? 'rgba(255,68,68,0.85)' : ok === true ? '#39ff14' : 'rgba(57,255,20,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )

  return (
    <div style={{
      width: '190px',
      minWidth: '190px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '10px 14px',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '10px',
      letterSpacing: '0.05em',
      lineHeight: '1.7',
      borderRight: '1px solid rgba(57,255,20,0.12)',
      flexShrink: 0
    }}>
      <div style={{ color: 'rgba(57,255,20,0.3)', fontSize: '9px', letterSpacing: '0.12em', marginBottom: '4px' }}>
        // SYS_STATUS
      </div>
      {line('SRV', hasServer ? 'ONLINE' : 'NO_SRC', hasServer)}
      {line('DEV', isConnected && deviceName ? deviceName.toUpperCase().slice(0, 16) : 'OFFLINE', isConnected)}
      {line('LIB', totalGames ? `${totalGames} TITLES` : 'EMPTY')}
      {installedGames > 0 && line('INST', String(installedGames))}
      {updatesAvailable > 0 && line('UPD', `${updatesAvailable} READY`, true)}
      <div style={{ color: 'rgba(57,255,20,0.25)', marginTop: '4px', fontSize: '9px' }}>
        {cursor ? '█' : ' '}_
      </div>
    </div>
  )
}

export default HackerConsole
