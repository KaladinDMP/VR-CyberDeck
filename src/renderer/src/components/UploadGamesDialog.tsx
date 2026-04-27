import React, { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHeaderCell,
  TableRow,
  TableCell,
  Checkbox,
  Text
} from '@fluentui/react-components'
import { useGames } from '../hooks/useGames'
import { useAdb } from '@renderer/hooks/useAdb'
import { useUpload } from '@renderer/hooks/useUpload'
import { useLanguage } from '@renderer/hooks/useLanguage'

const UploadGamesDialog: React.FC = () => {
  const { uploadCandidates, uploadCandidatesVersion, addGameToBlacklist } = useGames()
  const { selectedDevice } = useAdb()
  const { addToQueue } = useUpload()
  const { t } = useLanguage()

  const [showUploadDialog, setShowUploadDialog] = useState<boolean>(false)
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, boolean>>({})
  const [crackedFlags, setCrackedFlags] = useState<Record<string, boolean>>({})
  const [isQueuing, setIsQueuing] = useState<boolean>(false)
  const [queuedCount, setQueuedCount] = useState<number>(0)

  const lastShownVersion = useRef(0)

  useEffect(() => {
    if (uploadCandidates?.length > 0 && uploadCandidatesVersion > lastShownVersion.current) {
      lastShownVersion.current = uploadCandidatesVersion
      const initialSelected = uploadCandidates.reduce(
        (acc, c) => { acc[c.packageName] = true; return acc },
        {} as Record<string, boolean>
      )
      setSelectedCandidates(initialSelected)
      setCrackedFlags({})
      setShowUploadDialog(true)
    }
  }, [uploadCandidates, uploadCandidatesVersion])

  const handleCandidateToggle = (packageName: string): void => {
    setSelectedCandidates((prev) => ({ ...prev, [packageName]: !prev[packageName] }))
  }

  const handleCrackedToggle = (packageName: string): void => {
    setCrackedFlags((prev) => ({ ...prev, [packageName]: !prev[packageName] }))
  }

  const handleSelectAll = (checked: boolean): void => {
    setSelectedCandidates(
      uploadCandidates.reduce((acc, c) => { acc[c.packageName] = checked; return acc }, {} as Record<string, boolean>)
    )
  }

  const handleReverseSelection = (): void => {
    setSelectedCandidates(
      uploadCandidates.reduce((acc, c) => { acc[c.packageName] = !selectedCandidates[c.packageName]; return acc }, {} as Record<string, boolean>)
    )
  }

  const getHeaderCheckboxState = (): { checked: boolean; indeterminate: boolean } => {
    if (!uploadCandidates?.length) return { checked: false, indeterminate: false }
    const selectedCount = Object.values(selectedCandidates).filter(Boolean).length
    return {
      checked: selectedCount > 0 && selectedCount === uploadCandidates.length,
      indeterminate: selectedCount > 0 && selectedCount < uploadCandidates.length
    }
  }

  const resolvedGameName = (packageName: string, gameName: string): string =>
    crackedFlags[packageName] ? `${gameName}_CRACKED` : gameName

  const handleUpload = async (): Promise<void> => {
    const toUpload = uploadCandidates.filter((c) => selectedCandidates[c.packageName])
    setIsQueuing(true)
    let count = 0
    for (const c of toUpload) {
      const ok = await addToQueue(c.packageName, resolvedGameName(c.packageName, c.gameName), c.versionCode, selectedDevice!)
      if (ok) count++
    }
    setQueuedCount(count)
    setIsQueuing(false)
    setTimeout(() => setShowUploadDialog(false), 900)
  }

  const handleBlacklist = async (): Promise<void> => {
    const toBlacklist = uploadCandidates.filter((c) => selectedCandidates[c.packageName])
    const closeAfter = toBlacklist.length === uploadCandidates.length
    for (const c of toBlacklist) {
      await addGameToBlacklist(c.packageName, c.versionCode)
    }
    if (closeAfter) setShowUploadDialog(false)
  }

  const handleUploadSelectedBlacklistRest = async (): Promise<void> => {
    const toUpload    = uploadCandidates.filter((c) =>  selectedCandidates[c.packageName])
    const toBlacklist = uploadCandidates.filter((c) => !selectedCandidates[c.packageName])
    setShowUploadDialog(false)
    for (const c of toBlacklist) {
      await addGameToBlacklist(c.packageName, c.versionCode)
    }
    for (const c of toUpload) {
      await addToQueue(c.packageName, resolvedGameName(c.packageName, c.gameName), c.versionCode, selectedDevice!)
    }
  }

  const headerCheckboxState = getHeaderCheckboxState()
  const anySelected = Object.values(selectedCandidates).some(Boolean)
  const anyUnselected = uploadCandidates.some((c) => !selectedCandidates[c.packageName])

  return (
    <Dialog open={showUploadDialog} onOpenChange={(_, data) => setShowUploadDialog(data.open)}>
      <DialogSurface
        mountNode={document.getElementById('portal')}
        style={{ maxWidth: '1100px', background: '#050514', border: '1px solid rgba(var(--vrcd-neon-raw),0.35)', ['--colorNeutralForeground1' as string]: 'var(--vrcd-neon)', ['--colorNeutralForeground2' as string]: 'rgba(var(--vrcd-neon-raw),0.75)', ['--colorNeutralBackground1' as string]: '#050514', ['--colorNeutralStroke1' as string]: 'rgba(var(--vrcd-neon-raw),0.25)', ['--colorBrandBackground' as string]: 'var(--vrcd-neon)', ['--colorNeutralForegroundOnBrand' as string]: '#050514' }}
      >
        <DialogBody>
          <DialogTitle>{t('uploadGamesTitle')}</DialogTitle>
          <DialogContent>
            <Text>{t('uploadGamesDescription')}</Text>

            <Table style={{ marginTop: '16px' }}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell style={{ width: '80px' }}>
                    <Checkbox
                      checked={headerCheckboxState.indeterminate ? 'mixed' : headerCheckboxState.checked}
                      onChange={(_e, data) => handleSelectAll(!!data.checked)}
                    />
                    {t('uploadColumn')}
                  </TableHeaderCell>
                  <TableHeaderCell>{t('game')}</TableHeaderCell>
                  <TableHeaderCell>{t('packageName')}</TableHeaderCell>
                  <TableHeaderCell style={{ width: '100px' }}>{t('version')}</TableHeaderCell>
                  <TableHeaderCell>{t('status')}</TableHeaderCell>
                  <TableHeaderCell style={{ width: '90px' }} title="Mark as a modified/patched build — appends _CRACKED to the upload name">
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,120,0,0.9)', letterSpacing: '0.06em' }}>CRACKED</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadCandidates
                  .sort((a, b) => a.reason.localeCompare(b.reason))
                  .map((candidate) => {
                    const isCracked = crackedFlags[candidate.packageName] || false
                    return (
                      <TableRow key={candidate.packageName}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCandidates[candidate.packageName] || false}
                            onChange={() => handleCandidateToggle(candidate.packageName)}
                          />
                        </TableCell>
                        <TableCell>
                          <span style={isCracked ? { color: 'rgba(255,140,0,0.9)', fontFamily: 'monospace' } : undefined}>
                            {isCracked ? `${candidate.gameName}_CRACKED` : candidate.gameName}
                          </span>
                        </TableCell>
                        <TableCell>{candidate.packageName}</TableCell>
                        <TableCell>{candidate.versionCode}</TableCell>
                        <TableCell>
                          {candidate.reason === 'missing'
                            ? t('missingFromDatabase')
                            : `${t('newerThanDatabase')} (${candidate.storeVersion})`}
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={isCracked}
                            onChange={() => handleCrackedToggle(candidate.packageName)}
                            aria-label="Mark as cracked"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </DialogContent>

          <DialogActions>
            {queuedCount > 0 && !isQueuing && (
              <Text size={200} style={{ color: 'rgba(var(--vrcd-neon-raw),0.8)', fontFamily: 'monospace', marginRight: 'auto' }}>
                ✓ {queuedCount} queued
              </Text>
            )}

            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" disabled={isQueuing}>{t('cancel')}</Button>
            </DialogTrigger>

            <Button appearance="secondary" onClick={handleReverseSelection} disabled={isQueuing}>
              Reverse selection
            </Button>

            <Button
              appearance="secondary"
              onClick={handleBlacklist}
              disabled={!anySelected || isQueuing}
            >
              {t('blacklistSelected')}
            </Button>

            <Button
              appearance="secondary"
              onClick={handleUploadSelectedBlacklistRest}
              disabled={!anySelected || !anyUnselected || isQueuing}
              title="Upload the selected games and blacklist all unchecked games"
            >
              Upload selected, blacklist rest
            </Button>

            <Button
              appearance="primary"
              onClick={handleUpload}
              disabled={!anySelected || isQueuing}
            >
              {isQueuing ? 'Queuing...' : t('uploadSelectedGames')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

export default UploadGamesDialog
