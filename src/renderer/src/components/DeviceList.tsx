import React from 'react'
import { useAdb } from '../hooks/useAdb'
import { ExtendedDeviceInfo, hasBookmarkData, isWiFiBookmark } from '@shared/types'
// Import Fluent UI components and icons
import {
  Button,
  Card,
  CardHeader,
  CardPreview,
  Spinner,
  Body1,
  Title3,
  makeStyles,
  tokens,
  shorthands,
  Text,
  Input,
  Field
} from '@fluentui/react-components'
import {
  DeviceMeetingRoomRegular,
  PlugDisconnectedRegular,
  ArrowClockwiseRegular as RefreshIcon,
  BatteryChargeRegular,
  StorageRegular,
  DismissCircleRegular,
  WarningRegular,
  ErrorCircleRegular,
  BookmarkRegular,
  Wifi1Regular,
  CheckmarkCircleRegular,
  DismissCircleRegular as DisconnectedCircleRegular,
  ClockRegular,
  WindowConsoleRegular
} from '@fluentui/react-icons'
import { AdbShellDialog } from './AdbShellDialog'

interface DeviceListProps {
  onSkip?: () => void
  onConnected?: () => void
}

const useStyles = makeStyles({
  card: {
    width: '100%',
    maxWidth: '600px',
    margin: 'auto'
  },
  headerActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS
  },
  deviceListContainer: {
    marginTop: tokens.spacingVerticalL,
    marginBottom: tokens.spacingVerticalL
  },
  deviceItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover
    },
    cursor: 'default'
  },
  wifiBookmarkDevice: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorBrandStroke2),
    marginTop: tokens.spacingVerticalXS,
    ':hover': {
      backgroundColor: tokens.colorBrandBackground2Hover
    },
    cursor: 'default'
  },
  deviceInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM
  },
  deviceText: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingHorizontalXXS
  },
  deviceId: {
    fontWeight: tokens.fontWeightSemibold
  },
  deviceType: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200
  },
  wifiDeviceType: {
    color: tokens.colorBrandForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightMedium
  },
  deviceDetailsLine: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200
  },
  statusBadge: {
    marginLeft: tokens.spacingHorizontalS
  },
  messageArea: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground2
  },
  warningText: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorPalettePumpkinBorderActive,
    fontSize: tokens.fontSizeBase200,
    marginTop: tokens.spacingVerticalXXS
  },
  deviceStatusText: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorPaletteRedBorderActive,
    fontSize: tokens.fontSizeBase200,
    marginTop: tokens.spacingVerticalXXS
  }
})

const DeviceList: React.FC<DeviceListProps> = ({ onSkip, onConnected }) => {
  const {
    devices,
    selectedDevice,
    isConnected,
    isLoading,
    error,
    connectToDevice,
    connectTcpDevice,
    disconnectTcpDevice,
    refreshDevices,
    disconnectDevice
  } = useAdb()
  const styles = useStyles()
  const [tcpIpAddress, setTcpIpAddress] = React.useState('')
  const [tcpPort, setTcpPort] = React.useState('5555')
  const [isTcpConnecting, setIsTcpConnecting] = React.useState(false)
  const [connectingDeviceId, setConnectingDeviceId] = React.useState<string | null>(null)
  const [connectionError, setConnectionError] = React.useState<string | null>(null)
  const [lastFailedDeviceId, setLastFailedDeviceId] = React.useState<string | null>(null)
  const [shellDialogDeviceId, setShellDialogDeviceId] = React.useState<string | null>(null)

  // Auto-connect: when a Quest headset appears and nothing is connected yet, select it
  const hasAutoConnected = React.useRef(false)
  React.useEffect(() => {
    if (isConnected || isLoading || hasAutoConnected.current) return
    const questDevice = devices.find(
      (d) => d.isQuestDevice && (d.type === 'device' || d.type === 'emulator')
    )
    if (!questDevice) return
    hasAutoConnected.current = true
    handleConnect(questDevice.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, isConnected, isLoading])

  // Get all bookmarked IP addresses to check for duplicates
  const bookmarkedIpAddresses = React.useMemo(() => {
    return devices
      .filter((device) => isWiFiBookmark(device) || hasBookmarkData(device))
      .map((device) => {
        if (isWiFiBookmark(device)) {
          return device.ipAddress
        }
        if (hasBookmarkData(device)) {
          return device.bookmarkData.ipAddress
        }
        return null
      })
      .filter((ip): ip is string => ip !== null)
  }, [devices])

  const handleConnect = async (serial: string): Promise<void> => {
    setConnectingDeviceId(serial)
    setConnectionError(null)
    setLastFailedDeviceId(null)
    try {
      const success = await connectToDevice(serial)
      if (success && onConnected) {
        onConnected()
        setLastFailedDeviceId(null)
      } else {
        // Check if the device ping status shows it's unreachable to provide better error message
        const currentDevice = devices.find((d) => d.id === serial)
        if (currentDevice?.pingStatus === 'unreachable') {
          setConnectionError(`Device ${currentDevice.ipAddress || serial} is unreachable (offline)`)
        } else {
          setConnectionError(`Failed to connect to device ${serial}`)
        }
        setLastFailedDeviceId(serial)
      }
    } catch {
      setConnectionError('Connection failed')
      setLastFailedDeviceId(serial)
    } finally {
      setConnectingDeviceId(null)
    }
  }

  const handleTcpConnect = async (): Promise<void> => {
    if (!tcpIpAddress.trim()) return

    setIsTcpConnecting(true)
    try {
      const port = parseInt(tcpPort) || 5555
      const deviceName = `${tcpIpAddress.trim()}:${port}`

      // Add as bookmark instead of direct connect
      const success = await window.api.wifiBookmarks.add(deviceName, tcpIpAddress.trim(), port)
      if (success) {
        // Clear the form and refresh to show the new bookmark
        setTcpIpAddress('')
        setTcpPort('5555')
        refreshDevices()
      }
    } finally {
      setIsTcpConnecting(false)
    }
  }

  const handleBookmarkDevice = async (device: {
    ipAddress?: string | null
    friendlyModelName?: string | null
    model?: string | null
    id: string
  }): Promise<void> => {
    if (!device.ipAddress) return

    const deviceName = device.friendlyModelName || device.model || device.id
    const success = await window.api.wifiBookmarks.add(
      `${deviceName} (${device.ipAddress})`,
      device.ipAddress,
      5555
    )

    if (success) {
      refreshDevices()
    }
  }

  const handleConnectBookmark = async (device: ExtendedDeviceInfo): Promise<void> => {
    if (!hasBookmarkData(device)) return

    const bookmarkData = device.bookmarkData
    const deviceId = device.id
    setConnectingDeviceId(deviceId)
    setConnectionError(null)
    setLastFailedDeviceId(null)
    try {
      // Use the AdbProvider's connectTcpDevice method to properly update connection state
      const success = await connectTcpDevice(bookmarkData.ipAddress, bookmarkData.port)
      if (success) {
        // Update last connected time
        await window.api.wifiBookmarks.updateLastConnected(bookmarkData.id)
        setLastFailedDeviceId(null)
        if (onConnected) {
          onConnected()
        }
      } else {
        // Check if the device ping status shows it's unreachable to provide better error message
        const currentDevice = devices.find((d) => d.id === deviceId)
        if (currentDevice?.pingStatus === 'unreachable') {
          setConnectionError(`Device ${bookmarkData.ipAddress} is unreachable (offline)`)
        } else {
          setConnectionError(`Failed to connect to ${bookmarkData.ipAddress}:${bookmarkData.port}`)
        }
        setLastFailedDeviceId(deviceId)
      }
    } catch {
      setConnectionError(`Connection to ${bookmarkData.ipAddress} failed`)
      setLastFailedDeviceId(deviceId)
    } finally {
      setConnectingDeviceId(null)
    }
  }

  const handleDeleteBookmark = async (device: ExtendedDeviceInfo): Promise<void> => {
    if (!hasBookmarkData(device)) return

    const success = await window.api.wifiBookmarks.remove(device.bookmarkData.id)
    if (success) {
      refreshDevices()
    }
  }

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Title3>Meta Quest Devices</Title3>}
        action={
          <div className={styles.headerActions}>
            <Button
              icon={<RefreshIcon />}
              onClick={() => refreshDevices()}
              disabled={isLoading}
              appearance="subtle"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
            {onSkip && !isConnected && (
              <Button onClick={onSkip} appearance="secondary">
                Skip Connection
              </Button>
            )}
            {onSkip && isConnected && (
              <Button onClick={onSkip} appearance="secondary">
                Continue
              </Button>
            )}
          </div>
        }
      />

      {/* TCP Connection Section */}
      <CardPreview
        style={{
          padding: tokens.spacingVerticalM,
          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
        }}
      >
        <Field label="Connect via TCP/IP">
          <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'end' }}>
            <Input
              placeholder="IP Address (e.g., 192.168.1.100)"
              value={tcpIpAddress}
              onChange={(_, data) => setTcpIpAddress(data.value)}
              style={{ flex: 1 }}
            />
            <Input
              placeholder="Port"
              value={tcpPort}
              onChange={(_, data) => setTcpPort(data.value)}
              style={{ width: '80px' }}
            />
            <Button
              icon={<BookmarkRegular />}
              onClick={handleTcpConnect}
              disabled={!tcpIpAddress.trim() || isTcpConnecting || isLoading}
              appearance="primary"
            >
              {isTcpConnecting ? 'Adding...' : 'Add Bookmark'}
            </Button>
          </div>
        </Field>
      </CardPreview>

      <CardPreview className={styles.deviceListContainer}>
        {error && (
          <Body1 className={styles.messageArea}>Error: {error}</Body1> // Show error clearly
        )}
        {!error && isLoading && devices.length === 0 && (
          <div className={styles.messageArea}>
            <Spinner size="small" /> Searching for devices...
          </div>
        )}
        {!error && !isLoading && devices.length === 0 && (
          <Body1 className={styles.messageArea}>
            No devices found. Ensure device is connected and in ADB mode.
          </Body1>
        )}
        {!error && devices.length > 0 && (
          <div>
            {' '}
            {devices.map((device) => {
              const isCurrentDeviceConnected = selectedDevice === device.id && isConnected
              const isConnectable = device.type === 'device' || device.type === 'emulator'
              const isKnownQuestDevice = device.isQuestDevice
              const isTcpDevice = device.id.includes(':') // TCP devices have format IP:PORT
              const isWifiBookmark = isWiFiBookmark(device)
              const isConnectedBookmark = hasBookmarkData(device) && isTcpDevice && isConnectable // Merged bookmark with real TCP device
              const isConnecting = connectingDeviceId === device.id
              const isAlreadyBookmarked =
                device.ipAddress && bookmarkedIpAddresses.includes(device.ipAddress)
              const showConnectionError = connectionError && lastFailedDeviceId === device.id

              let deviceStatusMessage = ''
              if (device.type === 'offline') deviceStatusMessage = 'Offline'
              else if (device.type === 'unauthorized')
                deviceStatusMessage = 'Unauthorized - Check device'
              else if (device.type === 'unknown') deviceStatusMessage = 'Unknown State'

              return (
                <div
                  key={device.id}
                  className={
                    isWifiBookmark || isConnectedBookmark
                      ? styles.wifiBookmarkDevice
                      : styles.deviceItem
                  }
                >
                  <div className={styles.deviceInfo}>
                    {isWifiBookmark || isConnectedBookmark ? (
                      <Wifi1Regular fontSize={24} />
                    ) : (
                      <DeviceMeetingRoomRegular fontSize={24} />
                    )}
                    <div className={styles.deviceText}>
                      <Text weight="semibold" className={styles.deviceId}>
                        {device.friendlyModelName || device.model || device.id}
                      </Text>
                      <Text
                        size={200}
                        className={
                          isWifiBookmark || isConnectedBookmark
                            ? styles.wifiDeviceType
                            : styles.deviceType
                        }
                      >
                        {isWifiBookmark
                          ? 'WiFi Bookmark'
                          : isConnectedBookmark
                            ? 'WiFi Device (Connected)'
                            : device.friendlyModelName
                              ? device.id
                              : device.type}
                        {!isConnectable && deviceStatusMessage && ` - ${deviceStatusMessage}`}
                      </Text>

                      {/* Warning for connectable non-Quest devices */}
                      {isConnectable &&
                        !isKnownQuestDevice &&
                        !isWifiBookmark &&
                        !isConnectedBookmark && (
                          <div className={styles.warningText}>
                            <WarningRegular fontSize={16} />
                            <Text size={200}>
                              Not a recognized Quest device. Connection may have unintended results.
                            </Text>
                          </div>
                        )}

                      {/* Status for non-connectable devices */}
                      {!isConnectable && deviceStatusMessage && !isWifiBookmark && (
                        <div className={styles.deviceStatusText}>
                          <ErrorCircleRegular fontSize={16} />
                          <Text size={200}>{deviceStatusMessage}</Text>
                        </div>
                      )}

                      {device.batteryLevel !== null && (
                        <div className={styles.deviceDetailsLine}>
                          <BatteryChargeRegular fontSize={16} />
                          <Text size={200}>{device.batteryLevel}%</Text>
                        </div>
                      )}
                      {device.storageFree !== null && device.storageTotal !== null && (
                        <div className={styles.deviceDetailsLine}>
                          <StorageRegular fontSize={16} />
                          <Text size={200}>
                            {`${device.storageFree} free / ${device.storageTotal} total`}
                          </Text>
                        </div>
                      )}

                      {device.ipAddress && (
                        <div className={styles.deviceDetailsLine}>
                          <PlugDisconnectedRegular fontSize={16} />
                          <Text size={200}>IP: {device.ipAddress}</Text>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: tokens.spacingHorizontalXS }}>
                    {/* Bookmark button for devices with IP addresses */}
                    {device.ipAddress && isConnectable && !isTcpDevice && !isWifiBookmark && (
                      <Button
                        icon={<BookmarkRegular />}
                        onClick={() => handleBookmarkDevice(device)}
                        appearance="subtle"
                        size="small"
                        aria-label="Bookmark device"
                        disabled={isAlreadyBookmarked}
                      >
                        {isAlreadyBookmarked ? 'Bookmarked' : 'Bookmark'}
                      </Button>
                    )}

                    {/* Show ping status for WiFi devices */}
                    {(isWifiBookmark || isConnectedBookmark) && device.ipAddress && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: tokens.spacingHorizontalXXS
                        }}
                      >
                        {device.pingStatus === 'checking' && (
                          <>
                            <ClockRegular
                              fontSize={16}
                              style={{ color: tokens.colorNeutralForeground3 }}
                            />
                            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                              Checking...
                            </Text>
                          </>
                        )}
                        {device.pingStatus === 'reachable' && (
                          <>
                            <CheckmarkCircleRegular
                              fontSize={16}
                              style={{ color: tokens.colorPaletteGreenForeground1 }}
                            />
                            <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
                              Online{' '}
                              {device.pingResponseTime ? `(${device.pingResponseTime}ms)` : ''}
                            </Text>
                          </>
                        )}
                        {device.pingStatus === 'unreachable' && (
                          <>
                            <DisconnectedCircleRegular
                              fontSize={16}
                              style={{ color: tokens.colorPaletteRedForeground1 }}
                            />
                            <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                              Offline
                            </Text>
                          </>
                        )}
                      </div>
                    )}

                    {/* Show connection error if any */}
                    {showConnectionError && (
                      <Text
                        size={200}
                        style={{ color: tokens.colorPaletteRedForeground1, padding: '10px' }}
                      >
                        {connectionError}
                      </Text>
                    )}

                    {/* Delete button for WiFi bookmarks (both connected and disconnected) */}
                    {(isWifiBookmark || isConnectedBookmark) && (
                      <Button
                        icon={<DismissCircleRegular />}
                        onClick={() => handleDeleteBookmark(device)}
                        appearance="subtle"
                        size="small"
                        aria-label="Delete bookmark"
                      >
                        Delete
                      </Button>
                    )}

                    {/* ADB Shell button for any currently-connected device */}
                    {isCurrentDeviceConnected && (
                      <Button
                        icon={<WindowConsoleRegular />}
                        onClick={() => setShellDialogDeviceId(device.id)}
                        appearance="subtle"
                        size="small"
                        aria-label="Open ADB shell"
                      >
                        ADB Shell
                      </Button>
                    )}

                    {(isConnectedBookmark && isCurrentDeviceConnected) ||
                    (isTcpDevice && isConnectable && isCurrentDeviceConnected) ? (
                      <Button
                        icon={<DismissCircleRegular />}
                        onClick={async () => {
                          const [ip, port] = device.id.split(':')
                          await disconnectTcpDevice(ip, parseInt(port) || 5555)
                        }}
                        appearance="outline"
                        aria-label="Disconnect TCP device"
                      >
                        Disconnect
                      </Button>
                    ) : isCurrentDeviceConnected ? (
                      <Button
                        icon={<DismissCircleRegular />}
                        onClick={disconnectDevice}
                        appearance="outline"
                        aria-label="Disconnect device"
                      >
                        Disconnect
                      </Button>
                    ) : isWifiBookmark ? (
                      <Button
                        icon={<PlugDisconnectedRegular />}
                        onClick={() => handleConnectBookmark(device)}
                        appearance="outline"
                        aria-label="Connect to bookmarked device"
                        disabled={isConnecting}
                      >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Button>
                    ) : isConnectable ? (
                      <Button
                        icon={<PlugDisconnectedRegular />}
                        appearance="outline"
                        onClick={() => handleConnect(device.id)}
                        disabled={isLoading || isConnecting}
                      >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Button>
                    ) : (
                      // No button for non-connectable devices, or a disabled one if preferred
                      <Button
                        icon={<PlugDisconnectedRegular />}
                        appearance="outline"
                        disabled={true}
                      >
                        Cannot Connect
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardPreview>

      {shellDialogDeviceId && (
        <AdbShellDialog
          deviceId={shellDialogDeviceId}
          isOpen={shellDialogDeviceId !== null}
          onDismiss={() => setShellDialogDeviceId(null)}
        />
      )}
    </Card>
  )
}

export default DeviceList
