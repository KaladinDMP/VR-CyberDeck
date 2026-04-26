import React, { useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react'
import {
  DeviceInfo,
  PackageInfo,
  ExtendedDeviceInfo,
  DeviceWithBookmark,
  hasBookmarkData,
  isTcpDevice
} from '@shared/types'
import { AdbContext, AdbContextType } from './AdbContext'
import { useDependency } from '@renderer/hooks/useDependency'

interface AdbProviderProps {
  children: ReactNode
}

export const AdbProvider: React.FC<AdbProviderProps> = ({ children }) => {
  const [devices, setDevices] = useState<ExtendedDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [packages, setPackages] = useState<PackageInfo[]>([])
  const [loadingPackages, setLoadingPackages] = useState<boolean>(false)
  const [userName, setUserNameState] = useState<string>('')
  const [loadingUserName, setLoadingUserName] = useState<boolean>(false)
  const { isReady } = useDependency()
  // const [isInitialLoadComplete, setIsInitialLoadComplete] = useState<boolean>(false)
  const selectedDeviceDetails = devices.find((device) => device.id === selectedDevice) ?? null

  // Ref to access current selectedDevice inside stable effect callbacks without re-registering listeners
  const selectedDeviceRef = useRef(selectedDevice)
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice
  }, [selectedDevice])

  // Helper function to merge a device with bookmarks
  const mergeDeviceWithBookmarks = useCallback(
    async (device: DeviceInfo): Promise<ExtendedDeviceInfo> => {
      // Only merge TCP devices
      if (!isTcpDevice(device)) {
        return device
      }

      try {
        const bookmarks = await window.api.wifiBookmarks.getAll()
        const matchingBookmark = bookmarks.find(
          (bookmark) => `${bookmark.ipAddress}:${bookmark.port}` === device.id
        )

        if (matchingBookmark) {
          // This TCP device matches a bookmark - merge them
          return {
            ...device, // Use the real device data (battery, storage, etc.)
            friendlyModelName: matchingBookmark.name, // But keep the bookmark's friendly name
            bookmarkData: matchingBookmark // And keep the bookmark data for actions
          } as DeviceWithBookmark
        }
      } catch (error) {
        console.error('Error fetching bookmarks for merge:', error)
      }

      return device
    },
    []
  )

  // Initialize device tracking when provider mounts
  useEffect(() => {
    if (!isReady) return
    // if (!isInitialLoadComplete) return
    window.api.adb.startTrackingDevices()

    // Device listeners with bookmark merging
    const removeDeviceAdded = window.api.adb.onDeviceAdded(async (device: DeviceInfo) => {
      const mergedDevice = await mergeDeviceWithBookmarks(device)

      setDevices((prevDevices) => {
        // Check if device already exists
        if (prevDevices.some((d) => d.id === device.id)) {
          return prevDevices
        }

        // If this is a TCP device that matches a bookmark, remove the bookmark entry
        if (isTcpDevice(device) && hasBookmarkData(mergedDevice)) {
          const bookmarkData = mergedDevice.bookmarkData
          const bookmarkId = `wifi-bookmark:${bookmarkData.id}`
          const filteredDevices = prevDevices.filter((d) => d.id !== bookmarkId)

          // Insert the merged device before any WiFi bookmarks
          const wifiBookmarks = filteredDevices.filter((d) => d.type === 'wifi-bookmark')
          const otherDevices = filteredDevices.filter((d) => d.type !== 'wifi-bookmark')
          return [...otherDevices, mergedDevice, ...wifiBookmarks]
        }

        // For regular devices, add before WiFi bookmarks
        const wifiBookmarks = prevDevices.filter((d) => d.type === 'wifi-bookmark')
        const otherDevices = prevDevices.filter((d) => d.type !== 'wifi-bookmark')
        return [...otherDevices, mergedDevice, ...wifiBookmarks]
      })
    })

    const removeDeviceRemoved = window.api.adb.onDeviceRemoved((device) => {
      setDevices((prevDevices) => {
        const filteredDevices = prevDevices.filter((d) => d.id !== device.id)

        // If a TCP device was removed and it had bookmark data, restore the bookmark at the end
        const removedDevice = prevDevices.find((d) => d.id === device.id)
        if (removedDevice && isTcpDevice(device) && hasBookmarkData(removedDevice)) {
          const bookmark = removedDevice.bookmarkData
          const bookmarkDevice: DeviceWithBookmark = {
            id: `wifi-bookmark:${bookmark.id}`,
            type: 'wifi-bookmark' as const,
            model: null,
            isQuestDevice: false,
            batteryLevel: null,
            storageTotal: null,
            storageFree: null,
            friendlyModelName: bookmark.name,
            ipAddress: bookmark.ipAddress,
            bookmarkData: bookmark
          }

          // Add bookmark at the end
          return [...filteredDevices, bookmarkDevice]
        }

        return filteredDevices
      })

      // If currently selected device was removed, reset the connection
      if (selectedDeviceRef.current === device.id) {
        setSelectedDevice(null)
        setIsConnected(false)
        setPackages([]) // Clear packages when device is removed
        // Notify download service about disconnection
        window.api.downloads.setAppConnectionState(null, false)
      }
    })

    const removeDeviceChanged = window.api.adb.onDeviceChanged(async (device) => {
      const mergedDevice = await mergeDeviceWithBookmarks(device)

      // Check if the changed device is the currently selected device and is going offline
      if (
        selectedDeviceRef.current === device.id &&
        (device.type === 'offline' || device.type === 'unauthorized')
      ) {
        console.log(
          `[AdbProvider] Currently selected device ${device.id} went ${device.type}, disconnecting from app`
        )
        setSelectedDevice(null)
        setIsConnected(false)
        setPackages([])
        setUserNameState('')
        // Notify download service about disconnection
        window.api.downloads.setAppConnectionState(null, false)
      }

      setDevices((prevDevices) => {
        const existingDeviceIndex = prevDevices.findIndex((d) => d.id === device.id)
        if (existingDeviceIndex !== -1) {
          // Device exists, check if it's going offline and has bookmark data
          const existingDevice = prevDevices[existingDeviceIndex]

          // If a TCP device with bookmark data goes offline, restore the bookmark instead
          if (
            isTcpDevice(device) &&
            (device.type === 'offline' || device.type === 'unauthorized') &&
            hasBookmarkData(existingDevice)
          ) {
            const bookmark = existingDevice.bookmarkData
            const bookmarkDevice: DeviceWithBookmark = {
              id: `wifi-bookmark:${bookmark.id}`,
              type: 'wifi-bookmark' as const,
              model: null,
              isQuestDevice: false,
              batteryLevel: null,
              storageTotal: null,
              storageFree: null,
              friendlyModelName: bookmark.name,
              ipAddress: bookmark.ipAddress,
              bookmarkData: bookmark
            }

            // Remove the offline device and add bookmark at the end
            const filteredDevices = prevDevices.filter((d) => d.id !== device.id)
            return [...filteredDevices, bookmarkDevice]
          }

          // Normal device update - maintain position
          const newDevices = [...prevDevices]
          newDevices[existingDeviceIndex] = mergedDevice
          return newDevices
        } else {
          // Device doesn't exist, add it (handles transition from offline/auth to device)
          // Also handle bookmark merging like in onDeviceAdded
          if (isTcpDevice(device) && hasBookmarkData(mergedDevice)) {
            const bookmarkData = mergedDevice.bookmarkData
            const bookmarkId = `wifi-bookmark:${bookmarkData.id}`
            const filteredDevices = prevDevices.filter((d) => d.id !== bookmarkId)

            // Insert the merged device before any WiFi bookmarks
            const wifiBookmarks = filteredDevices.filter((d) => d.type === 'wifi-bookmark')
            const otherDevices = filteredDevices.filter((d) => d.type !== 'wifi-bookmark')
            return [...otherDevices, mergedDevice, ...wifiBookmarks]
          }

          // For regular devices, add before WiFi bookmarks
          const wifiBookmarks = prevDevices.filter((d) => d.type === 'wifi-bookmark')
          const otherDevices = prevDevices.filter((d) => d.type !== 'wifi-bookmark')
          return [...otherDevices, mergedDevice, ...wifiBookmarks]
        }
      })
    })

    const removeTrackerError = window.api.adb.onTrackerError((errorMsg) => {
      setError(`Device tracking error: ${errorMsg}`)
    })

    // Initial device load
    refreshDevices()

    return () => {
      window.api.adb.stopTrackingDevices()
      removeDeviceAdded()
      removeDeviceRemoved()
      removeDeviceChanged()
      removeTrackerError()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, mergeDeviceWithBookmarks])

  // Load installed packages from connected device
  const loadPackages = useCallback(async (): Promise<void> => {
    console.log('Loading packages for device:', selectedDevice)
    if (!selectedDevice) return
    try {
      setLoadingPackages(true)
      setError(null)
      const installedPackages = await window.api.adb.getInstalledPackages(selectedDevice)
      setPackages(installedPackages)
    } catch (err) {
      setError('Failed to load packages')
      console.error('Error loading packages:', err)
    } finally {
      setLoadingPackages(false)
    }
  }, [selectedDevice])

  const getUserName = useCallback(async (): Promise<string> => {
    console.log('Getting user name for device:', selectedDevice)
    if (!selectedDevice) return ''

    try {
      setLoadingUserName(true)
      const userName = await window.api.adb.getUserName(selectedDevice)
      setUserNameState(userName)
      return userName
    } catch (err) {
      console.error('Error getting user name:', err)
      return ''
    } finally {
      setLoadingUserName(false)
    }
  }, [selectedDevice])

  const setUserName = useCallback(
    async (name: string): Promise<void> => {
      console.log('Setting user name for device:', selectedDevice)
      if (!selectedDevice) return

      try {
        setLoadingUserName(true)
        await window.api.adb.setUserName(selectedDevice, name)
        setUserNameState(name)
      } catch (err) {
        console.error('Error setting user name:', err)
        throw err
      } finally {
        setLoadingUserName(false)
      }
    },
    [selectedDevice]
  )

  // Load packages when device is connected
  useEffect(() => {
    if (isConnected && selectedDevice) {
      loadPackages()
      getUserName()
    } else {
      setPackages([])
      setUserNameState('')
    }
  }, [isConnected, selectedDevice, loadPackages, getUserName])

  // Periodically refresh device info (battery + storage) while a device is connected,
  // so the storage indicator reflects installs/uninstalls without requiring a reconnect.
  useEffect(() => {
    if (!isConnected || !selectedDevice) return
    const id = setInterval(() => {
      refreshDevices().catch(() => { /* swallow; UI keeps last-known values */ })
    }, 60_000)
    return () => clearInterval(id)
  }, [isConnected, selectedDevice])

  // Helper function to ping WiFi devices and update their status
  const pingWifiDevices = useCallback(
    async (devicesToUpdate: ExtendedDeviceInfo[]): Promise<void> => {
      // Find all devices that have IP addresses and should be pinged
      const devicesToPing = devicesToUpdate.filter((device) => {
        return device.ipAddress && (isTcpDevice(device) || device.type === 'wifi-bookmark')
      })

      if (devicesToPing.length === 0) return

      // Set ping status to "checking" for all devices with IP addresses
      setDevices((prevDevices) =>
        prevDevices.map((device) => {
          if (device.ipAddress && (isTcpDevice(device) || device.type === 'wifi-bookmark')) {
            return { ...device, pingStatus: 'checking' as const }
          }
          return device
        })
      )

      // Ping all devices in parallel
      const pingPromises = devicesToPing.map(async (device) => {
        try {
          const result = await window.api.adb.pingDevice(device.ipAddress!)
          return {
            deviceId: device.id,
            reachable: result.reachable,
            responseTime: result.responseTime
          }
        } catch (error) {
          console.error(`Error pinging ${device.ipAddress}:`, error)
          return {
            deviceId: device.id,
            reachable: false,
            responseTime: undefined
          }
        }
      })

      // Wait for all pings to complete
      const pingResults = await Promise.all(pingPromises)

      // Update device ping status with results
      setDevices((prevDevices) =>
        prevDevices.map((device) => {
          const pingResult = pingResults.find((result) => result.deviceId === device.id)
          if (pingResult) {
            return {
              ...device,
              pingStatus: pingResult.reachable ? ('reachable' as const) : ('unreachable' as const),
              pingResponseTime: pingResult.responseTime
            }
          }
          return device
        })
      )
    },
    []
  )

  const refreshDevices = async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)
      const [deviceList, bookmarks] = await Promise.all([
        window.api.adb.listDevices(),
        window.api.wifiBookmarks.getAll()
      ])

      // Create a map of TCP devices by their IP:port
      const tcpDeviceMap = new Map<string, DeviceInfo>()
      deviceList.forEach((device) => {
        if (isTcpDevice(device)) {
          // This is a TCP device (format: IP:PORT)
          tcpDeviceMap.set(device.id, device)
        }
      })

      // Process bookmarks and merge with real TCP devices if connected
      const mergedBookmarkDevices: ExtendedDeviceInfo[] = bookmarks.map((bookmark) => {
        const expectedTcpId = `${bookmark.ipAddress}:${bookmark.port}`
        const realTcpDevice = tcpDeviceMap.get(expectedTcpId)

        if (realTcpDevice) {
          // This bookmark has a corresponding real TCP device - merge them
          // Remove the real device from the map so it doesn't appear twice
          tcpDeviceMap.delete(expectedTcpId)

          return {
            ...realTcpDevice, // Use the real device data (battery, storage, etc.)
            friendlyModelName: bookmark.name, // But keep the bookmark's friendly name
            bookmarkData: bookmark // And keep the bookmark data for actions
          } as DeviceWithBookmark
        } else {
          // No corresponding real device - show as disconnected bookmark
          return {
            id: `wifi-bookmark:${bookmark.id}`,
            type: 'wifi-bookmark' as const,
            model: null,
            isQuestDevice: false,
            batteryLevel: null,
            storageTotal: null,
            storageFree: null,
            friendlyModelName: bookmark.name,
            ipAddress: bookmark.ipAddress,
            bookmarkData: bookmark,
            pingStatus: 'unknown' as const
          } as DeviceWithBookmark
        }
      })

      // Get remaining non-TCP devices and unmatched TCP devices
      const nonTcpDevices = deviceList.filter((device) => !isTcpDevice(device))
      const unmatchedTcpDevices = Array.from(tcpDeviceMap.values())

      // Separate connected bookmark devices from disconnected ones
      const connectedBookmarkDevices = mergedBookmarkDevices.filter(
        (device) => device.type !== 'wifi-bookmark' // These are merged real TCP devices with bookmark data
      )
      const disconnectedBookmarkDevices = mergedBookmarkDevices.filter(
        (device) => device.type === 'wifi-bookmark' // These are pure bookmark entries
      )

      // Combine devices in order: non-TCP → unmatched TCP → connected bookmarks → disconnected bookmarks
      const allDevices = [
        ...nonTcpDevices,
        ...unmatchedTcpDevices,
        ...connectedBookmarkDevices,
        ...disconnectedBookmarkDevices
      ]

      setDevices(allDevices)

      // Start pinging WiFi devices after setting the initial device list
      // Don't await this to avoid blocking the UI
      pingWifiDevices(allDevices)
    } catch (err) {
      setError('Failed to load devices')
      console.error('Error loading devices:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const connectToDevice = async (serial: string): Promise<boolean> => {
    try {
      setError(null)

      // Check if this is a TCP device that might need a ping check
      const device = devices.find((d) => d.id === serial)
      if (device && isTcpDevice(device) && device.ipAddress) {
        // For TCP devices that are offline or have unreachable ping status, do a ping check first
        if (device.pingStatus === 'unreachable' || device.type === 'offline') {
          console.log(
            `[AdbProvider] Device ${serial} appears offline, checking connectivity first...`
          )

          // Update the device ping status to "checking"
          setDevices((prevDevices) =>
            prevDevices.map((d) =>
              d.id === device.id ? { ...d, pingStatus: 'checking' as const } : d
            )
          )

          const pingResult = await window.api.adb.pingDevice(device.ipAddress)

          // Update ping status based on result
          setDevices((prevDevices) =>
            prevDevices.map((d) =>
              d.id === device.id
                ? {
                    ...d,
                    pingStatus: pingResult.reachable
                      ? ('reachable' as const)
                      : ('unreachable' as const),
                    pingResponseTime: pingResult.responseTime
                  }
                : d
            )
          )

          if (!pingResult.reachable) {
            console.log(
              `[AdbProvider] Ping to ${device.ipAddress} failed, cancelling connection attempt`
            )
            return false
          }

          console.log(
            `[AdbProvider] Ping to ${device.ipAddress} successful, proceeding with connection`
          )
        }
      }

      // If already connected to a device, disconnect first
      if (isConnected && selectedDevice && selectedDevice !== serial) {
        console.log(
          `Disconnecting from current device ${selectedDevice} before connecting to ${serial}`
        )
        if (selectedDevice.includes(':')) {
          // Current device is TCP, disconnect properly
          const [ip, port] = selectedDevice.split(':')
          await window.api.adb.disconnectTcpDevice(ip, parseInt(port) || 5555)
        }
        // Reset connection state
        setSelectedDevice(null)
        setIsConnected(false)
        setPackages([])
        setUserNameState('')
        // Notify download service about disconnection
        window.api.downloads.setAppConnectionState(null, false)
      }

      const success = await window.api.adb.connectDevice(serial)
      if (success) {
        setSelectedDevice(serial)
        setIsConnected(true)
        // Notify download service about connection state
        window.api.downloads.setAppConnectionState(serial, true)
        return true
      } else {
        // Don't set global error for connection failures - let the UI handle it
        return false
      }
    } catch (err) {
      console.error('Error connecting to device:', err)
      // Don't set global error for connection failures - let the UI handle it
      return false
    }
  }

  const connectTcpDevice = async (ipAddress: string, port: number = 5555): Promise<boolean> => {
    try {
      setError(null)
      const deviceId = `${ipAddress}:${port}`

      // For TCP devices, always do a ping check first before attempting to connect
      console.log(`[AdbProvider] Checking connectivity to ${ipAddress} before TCP connection...`)

      // Find the device in our list to update its ping status
      const device = devices.find(
        (d) => d.id === deviceId || (hasBookmarkData(d) && d.bookmarkData.ipAddress === ipAddress)
      )

      if (device) {
        // Update the device ping status to "checking"
        setDevices((prevDevices) =>
          prevDevices.map((d) =>
            d.id === device.id ? { ...d, pingStatus: 'checking' as const } : d
          )
        )
      }

      const pingResult = await window.api.adb.pingDevice(ipAddress)

      // Update ping status based on result
      if (device) {
        setDevices((prevDevices) =>
          prevDevices.map((d) =>
            d.id === device.id
              ? {
                  ...d,
                  pingStatus: pingResult.reachable
                    ? ('reachable' as const)
                    : ('unreachable' as const),
                  pingResponseTime: pingResult.responseTime
                }
              : d
          )
        )
      }

      if (!pingResult.reachable) {
        console.log(`[AdbProvider] Ping to ${ipAddress} failed, cancelling TCP connection attempt`)
        return false
      }

      console.log(`[AdbProvider] Ping to ${ipAddress} successful, proceeding with TCP connection`)

      // If already connected to a device, disconnect first
      if (isConnected && selectedDevice && selectedDevice !== deviceId) {
        console.log(
          `Disconnecting from current device ${selectedDevice} before connecting to ${deviceId}`
        )
        if (selectedDevice.includes(':')) {
          // Current device is TCP, disconnect properly
          const [currentIp, currentPort] = selectedDevice.split(':')
          await window.api.adb.disconnectTcpDevice(currentIp, parseInt(currentPort) || 5555)
        }
        // Reset connection state
        setSelectedDevice(null)
        setIsConnected(false)
        setPackages([])
        setUserNameState('')
        // Notify download service about disconnection
        window.api.downloads.setAppConnectionState(null, false)
      }

      const success = await window.api.adb.connectTcpDevice(ipAddress, port)
      if (success) {
        setSelectedDevice(deviceId)
        setIsConnected(true)
        // Notify download service about connection state
        window.api.downloads.setAppConnectionState(deviceId, true)
        // Refresh devices to show the new TCP connection
        await refreshDevices()
        return true
      } else {
        // Don't set global error for connection failures - let the UI handle it
        return false
      }
    } catch (err) {
      console.error('Error connecting to TCP device:', err)
      // Don't set global error for connection failures - let the UI handle it
      return false
    }
  }

  const disconnectTcpDevice = async (ipAddress: string, port: number = 5555): Promise<boolean> => {
    try {
      setError(null)
      const success = await window.api.adb.disconnectTcpDevice(ipAddress, port)
      const deviceId = `${ipAddress}:${port}`

      // If this was the currently selected device, disconnect it
      if (selectedDevice === deviceId) {
        setSelectedDevice(null)
        setIsConnected(false)
        setPackages([])
        setUserNameState('')
        // Notify download service about disconnection
        window.api.downloads.setAppConnectionState(null, false)
      }

      // Refresh devices to remove the disconnected TCP device
      await refreshDevices()
      return success
    } catch (err) {
      setError('TCP disconnection error')
      console.error('Error disconnecting from TCP device:', err)
      return false
    }
  }

  const disconnectDevice = (): void => {
    setSelectedDevice(null)
    setIsConnected(false)
    setPackages([])
    setUserNameState('')
    // Notify download service about disconnection
    window.api.downloads.setAppConnectionState(null, false)
  }

  const pingDevice = useCallback(
    async (ipAddress: string): Promise<{ reachable: boolean; responseTime?: number }> => {
      try {
        return await window.api.adb.pingDevice(ipAddress)
      } catch (error) {
        console.error('Error pinging device:', error)
        return { reachable: false }
      }
    },
    []
  )

  const value = useMemo<AdbContextType>(
    () => ({
      devices,
      selectedDevice,
      isConnected,
      isLoading,
      error,
      packages,
      loadingPackages,
      userName,
      loadingUserName,
      connectToDevice,
      connectTcpDevice,
      disconnectTcpDevice,
      refreshDevices,
      disconnectDevice,
      loadPackages,
      selectedDeviceDetails,
      getUserName,
      setUserName,
      pingDevice
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, selectedDevice, isConnected, isLoading, error, packages, loadingPackages, userName, loadingUserName, selectedDeviceDetails, loadPackages, getUserName, setUserName, pingDevice]
  )

  // if (!isInitialLoadComplete) {
  //   return <div>Loading...</div>
  // }

  return <AdbContext.Provider value={value}>{children}</AdbContext.Provider>
}
