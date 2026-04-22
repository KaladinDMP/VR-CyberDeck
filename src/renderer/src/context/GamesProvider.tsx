import React, { ReactNode, useEffect, useState, useCallback, useMemo } from 'react'
import { BlacklistEntry, GameInfo, UploadCandidate } from '@shared/types'
import { GamesContext } from './GamesContext'
import { useAdb } from '../hooks/useAdb'
import { useDependency } from '../hooks/useDependency'

interface GamesProviderProps {
  children: ReactNode
}

// Helper function to parse version string (extract numbers)
const parseVersion = (versionString: string): number | null => {
  if (!versionString) return null
  const match = versionString.match(/\d+/g) // Find all sequences of digits
  if (!match) return null
  // Join digits and parse as integer (handles versions like "1.2.3" -> 123)
  try {
    return parseInt(match.join(''), 10)
  } catch (e) {
    console.warn(`Failed to parse version string: ${versionString}`, e)
    return null
  }
}

export const GamesProvider: React.FC<GamesProviderProps> = ({ children }) => {
  const [rawGames, setRawGames] = useState<GameInfo[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [extractProgress, setExtractProgress] = useState<number>(0)
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState<boolean>(false)
  const [uploadCandidates, setUploadCandidates] = useState<UploadCandidate[]>([])
  // Incremented only when checkForUploadCandidates finds fresh candidates (not when
  // addGameToBlacklist filters the list).  The dialog watches this to avoid re-opening
  // after the user has already dismissed or acted on a prompt.
  const [uploadCandidatesVersion, setUploadCandidatesVersion] = useState(0)
  // Allow the upload check on: first launch of day, first launch after update, manual reconnect
  const [forceUploadCheck, setForceUploadCheck] = useState(false)
  const [missingGames] = useState<GameInfo[]>([])
  const [outdatedGames] = useState<GameInfo[]>([])

  const {
    packages: installedPackages,
    isConnected: isDeviceConnected,
    selectedDevice,
    selectedDeviceDetails
  } = useAdb()
  const { isReady } = useDependency()

  // Detect version change on startup — triggers upload check on first launch post-update
  useEffect(() => {
    window.api.app?.getVersion?.()?.then((v) => {
      const storedVersion = localStorage.getItem('vr-upload-check-version') ?? ''
      if (storedVersion !== v) {
        setForceUploadCheck(true)
        localStorage.setItem('vr-upload-check-version', v)
      }
    }).catch(() => {})
  }, [])

  const requestUploadCheck = useCallback(() => {
    setForceUploadCheck(true)
  }, [])

  const addGameToBlacklist = useCallback(
    async (packageName: string, version?: number | 'any'): Promise<void> => {
      await window.api.games.addToBlacklist(packageName, version)
      // Use the functional-update form so rapid back-to-back calls each operate
      // on the latest state rather than the stale closure captured at creation time.
      setUploadCandidates((prev) => prev.filter((c) => c.packageName !== packageName))
    },
    []
  )

  const getBlacklistGames = useCallback(async (): Promise<BlacklistEntry[]> => {
    return await window.api.games.getBlacklistGames()
  }, [])

  const removeGameFromBlacklist = useCallback(async (packageName: string): Promise<void> => {
    await window.api.games.removeFromBlacklist(packageName)
  }, [])

  // Check for installed games that are missing from the database or newer than store versions.
  // Only runs on: first launch of day, first launch after update, or explicit requestUploadCheck().
  const checkForUploadCandidates = useCallback(() => {
    if (!isDeviceConnected || installedPackages.length === 0 || rawGames.length === 0) {
      return
    }

    // Date gate — skip if we already ran today (unless force-flagged)
    const today = new Date().toDateString()
    const lastCheckDate = localStorage.getItem('vr-upload-check-date') ?? ''
    if (!forceUploadCheck && lastCheckDate === today) {
      return
    }

    if (!selectedDeviceDetails?.isQuestDevice) {
      //return
    }

    const candidates: UploadCandidate[] = []

    // Build a Map for O(1) package lookups instead of O(n) .filter() per package
    const allGamePackages = new Set(rawGames.map((game) => game.packageName))
    const rawGamesMap = new Map<string, GameInfo[]>()
    for (const game of rawGames) {
      if (game.packageName) {
        const existing = rawGamesMap.get(game.packageName)
        if (existing) {
          existing.push(game)
        } else {
          rawGamesMap.set(game.packageName, [game])
        }
      }
    }

    // Process installed packages and filter by blacklist
    const processInstalledPackages = async (): Promise<void> => {
      for (const pkg of installedPackages) {
        // Skip blacklisted games
        if (await window.api.games.isGameBlacklisted(pkg.packageName, pkg.versionCode)) {
          continue
        }

        // Check if this package is missing from the store
        if (!allGamePackages.has(pkg.packageName)) {
          const applicationLabel = await window.api.adb.getApplicationLabel(
            selectedDevice || '',
            pkg.packageName
          )
          if (!applicationLabel) {
            console.error(`No application label found for ${pkg.packageName}, skipping...`)
            continue
          }
          candidates.push({
            packageName: pkg.packageName,
            gameName: applicationLabel,
            versionCode: pkg.versionCode,
            reason: 'missing'
          })
        } else {
          // Check if the local version is newer than ALL store versions with the same package name
          const storeGamesWithSamePackage = rawGamesMap.get(pkg.packageName) || []

          if (storeGamesWithSamePackage.length > 0) {
            // Check if installed version is newer than ALL versions in the store
            const isNewerThanAllStoreVersions = storeGamesWithSamePackage.every((storeGame) => {
              const storeVersionCode = parseVersion(storeGame.version)
              return storeVersionCode !== null && pkg.versionCode > storeVersionCode
            })

            if (isNewerThanAllStoreVersions) {
              // Get the latest store version for display
              const latestStoreGame = storeGamesWithSamePackage.reduce((latest, current) => {
                const latestVersion = parseVersion(latest.version) || 0
                const currentVersion = parseVersion(current.version) || 0
                return currentVersion > latestVersion ? current : latest
              }, storeGamesWithSamePackage[0])

              candidates.push({
                packageName: pkg.packageName,
                gameName: latestStoreGame.name || pkg.packageName,
                versionCode: pkg.versionCode,
                reason: 'newer',
                storeVersion: latestStoreGame.version
              })
            }
          }
        }
      }

      if (candidates.length > 0) {
        console.log('Found upload candidates:', candidates)
        setUploadCandidates(candidates)
        // Bump the version so the dialog knows these are freshly-detected candidates
        // and should be shown again (e.g. after the user clicked Refresh Quest).
        setUploadCandidatesVersion((v) => v + 1)
      }
    }

    // Mark that we ran today so subsequent launches/installs/refreshes are skipped
    localStorage.setItem('vr-upload-check-date', today)
    if (forceUploadCheck) setForceUploadCheck(false)

    processInstalledPackages()
  }, [isDeviceConnected, installedPackages, rawGames, selectedDeviceDetails, selectedDevice, forceUploadCheck])

  // Check for upload candidates whenever device versions or game data changes (deferred)
  useEffect(() => {
    const timer = setTimeout(() => checkForUploadCandidates(), 500)
    return () => clearTimeout(timer)
  }, [installedPackages, rawGames, checkForUploadCandidates])

  // Clear upload candidates when device disconnects
  useEffect(() => {
    if (!isDeviceConnected) {
      setUploadCandidates([])
    }
  }, [isDeviceConnected])

  // enrich the games with the installed packages and the device version codes
  const games = useMemo((): GameInfo[] => {
    // Build a Map for O(1) lookups instead of O(n) .find() per game
    const installedMap = new Map(
      installedPackages.map((pkg) => [pkg.packageName, pkg.versionCode])
    )

    return rawGames.map((game) => {
      const deviceVersionCode = game.packageName
        ? installedMap.get(game.packageName)
        : undefined
      const isInstalled = deviceVersionCode !== undefined
      let hasUpdate = false

      if (isInstalled && deviceVersionCode !== undefined) {
        const listVersionNumeric = parseVersion(game.version)
        if (listVersionNumeric !== null) {
          hasUpdate = listVersionNumeric > deviceVersionCode
        }
      }

      return {
        ...game,
        isInstalled,
        deviceVersionCode,
        hasUpdate
      }
    })
  }, [rawGames, installedPackages])

  const localGames = useMemo((): GameInfo[] => {
    return installedPackages.map((game) => ({
      id: game.packageName,
      packageName: game.packageName,
      name: game.packageName,
      version: String(game.versionCode),
      size: '0',
      lastUpdated: new Date().toISOString(),
      releaseName: game.packageName,
      downloads: 0,
      downloadsUpdated: new Date().toISOString(),
      isInstalled: true,
      thumbnailPath: '',
      notePath: ''
    }))
  }, [installedPackages])

  const loadGames = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      const gamesList = await window.api.games.getGames()
      setRawGames(gamesList)

      const syncTime = await window.api.games.getLastSyncTime()
      setLastSyncTime(syncTime ? new Date(syncTime) : null)
    } catch (err) {
      console.error('Error loading games:', err)
      setError('Failed to load games')
    } finally {
      setIsLoading(false)
      if (!isInitialLoadComplete) {
        setIsInitialLoadComplete(true)
      }
    }
  }, [isInitialLoadComplete])

  const getTrailerVideoId = useCallback(async (gameName: string): Promise<string | null> => {
    return await window.api.games.getTrailerVideoId(gameName)
  }, [])

  const refreshGames = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)
      setDownloadProgress(0)
      setExtractProgress(0)

      const gamesList = await window.api.games.forceSync()
      const syncTime = await window.api.games.getLastSyncTime()

      setRawGames(gamesList)
      setLastSyncTime(syncTime ? new Date(syncTime) : null)
    } catch (err) {
      console.error('Error refreshing games:', err)
      setError('Failed to refresh games')
    } finally {
      setIsLoading(false)
      setDownloadProgress(0)
      setExtractProgress(0)
    }
  }, [])

  useEffect(() => {
    const removeDownloadProgressListener = window.api.games.onDownloadProgress((progress) => {
      if (progress.stage === 'extract') {
        setExtractProgress(progress.progress)
      } else {
        setDownloadProgress(progress.progress)
      }
    })

    return () => {
      removeDownloadProgressListener()
    }
  }, [])

  useEffect(() => {
    const initializeAndLoad = async (): Promise<void> => {
      if (isReady && !isInitialLoadComplete) {
        console.log('Dependencies ready, initializing game service and loading games...')
        try {
          setIsLoading(true)
          //await window.api.initializeGameService()
          await loadGames()
        } catch (initError) {
          console.error('Failed to initialize game service or load games:', initError)
          setError(initError instanceof Error ? initError.message : 'Failed to load game data')
          setIsInitialLoadComplete(true)
        }
      }
    }
    initializeAndLoad()
  }, [isReady, loadGames, isInitialLoadComplete])

  const getNote = useCallback(async (releaseName: string): Promise<string> => {
    return await window.api.games.getNote(releaseName)
  }, [])

  const value = useMemo(
    () => ({
      games,
      localGames,
      isLoading,
      error,
      lastSyncTime,
      downloadProgress,
      extractProgress,
      refreshGames,
      loadGames,
      getNote,
      isInitialLoadComplete,
      outdatedGames,
      missingGames,
      uploadCandidates,
      uploadCandidatesVersion,
      getTrailerVideoId,
      addGameToBlacklist,
      getBlacklistGames,
      removeGameFromBlacklist,
      requestUploadCheck
    }),
    [
      games,
      localGames,
      isLoading,
      error,
      lastSyncTime,
      downloadProgress,
      extractProgress,
      refreshGames,
      loadGames,
      getNote,
      isInitialLoadComplete,
      outdatedGames,
      missingGames,
      uploadCandidates,
      uploadCandidatesVersion,
      getTrailerVideoId,
      addGameToBlacklist,
      getBlacklistGames,
      removeGameFromBlacklist,
      requestUploadCheck
    ]
  )

  return <GamesContext.Provider value={value}>{children}</GamesContext.Provider>
}
