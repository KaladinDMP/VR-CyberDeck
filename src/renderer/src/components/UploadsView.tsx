import React from 'react'
import {
  makeStyles,
  Text,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Button,
  tokens
} from '@fluentui/react-components'
import { useUpload } from '../hooks/useUpload'
import { useLanguage } from '../hooks/useLanguage'
import { UploadItem } from '@shared/types'
import { DismissRegular, DeleteRegular, ArrowCounterclockwiseRegular, DismissCircleRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  wrapper: {
    padding: '20px'
  },
  emptyState: {
    textAlign: 'center',
    margin: '40px 0'
  },
  progressBar: {
    height: '8px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progress: {
    height: '100%',
    backgroundColor: tokens.colorBrandBackground,
    borderRadius: '4px'
  }
})

const UploadRow: React.FC<{ item: UploadItem }> = ({ item }) => {
  const styles = useStyles()
  const { removeFromQueue, cancelUpload, retryUpload } = useUpload()
  const { t } = useLanguage()

  let statusElement = <Text>{item.status}</Text>
  let actions: React.ReactNode = null

  const progressValue = item.progress || 0

  switch (item.status) {
    case 'Queued':
      statusElement = <Text>{t('waitingInQueue')}</Text>
      actions = (
        <Button
          icon={<DismissRegular />}
          appearance="subtle"
          onClick={() => removeFromQueue(item.packageName)}
          aria-label={t('removeFromQueue')}
        />
      )
      break

    case 'Preparing':
    case 'Uploading':
      statusElement = (
        <>
          <Text>
            {item.stage || item.status} ({progressValue}%)
          </Text>
          <div className={styles.progressBar}>
            <div className={styles.progress} style={{ width: `${progressValue}%` }} />
          </div>
        </>
      )
      actions = (
        <Button
          icon={<DismissRegular />}
          appearance="subtle"
          onClick={() => cancelUpload(item.packageName)}
          aria-label={t('cancelUpload')}
        />
      )
      break

    case 'Completed':
      statusElement = <Text weight="semibold">{t('completed')}</Text>
      actions = (
        <Button
          icon={<DeleteRegular />}
          appearance="subtle"
          onClick={() => removeFromQueue(item.packageName)}
          aria-label={t('removeFromHistory')}
        />
      )
      break

    case 'Error':
      statusElement = (
        <>
          <Text
            weight="semibold"
            style={{ color: tokens.colorPaletteRedForeground1, marginRight: '4px' }}
          >
            {t('error')}
          </Text>
          {item.error && <Text size={200}>{item.error}</Text>}
        </>
      )
      actions = (
        <>
          <Button
            icon={<ArrowCounterclockwiseRegular />}
            appearance="subtle"
            onClick={() => retryUpload(item.packageName)}
            aria-label={t('retryUpload')}
            title={t('retryUpload')}
          />
          <Button
            icon={<DeleteRegular />}
            appearance="subtle"
            onClick={() => removeFromQueue(item.packageName)}
            aria-label={t('removeFromQueue')}
          />
        </>
      )
      break

    case 'Cancelled':
      statusElement = <Text>{t('cancelled')}</Text>
      actions = (
        <>
          <Button
            icon={<ArrowCounterclockwiseRegular />}
            appearance="subtle"
            onClick={() => retryUpload(item.packageName)}
            aria-label={t('retryUpload')}
            title={t('retryUpload')}
          />
          <Button
            icon={<DeleteRegular />}
            appearance="subtle"
            onClick={() => removeFromQueue(item.packageName)}
            aria-label={t('removeFromQueue')}
          />
        </>
      )
      break
  }

  return (
    <TableRow>
      <TableCell>{item.gameName}</TableCell>
      <TableCell style={{ wordBreak: 'break-all' }}>
        {item.isLocalUpload ? <em style={{ color: tokens.colorNeutralForeground3 }}>local</em> : item.packageName}
      </TableCell>
      <TableCell>{item.versionCode > 0 ? item.versionCode : '—'}</TableCell>
      <TableCell>{statusElement}</TableCell>
      <TableCell>{actions}</TableCell>
    </TableRow>
  )
}

const UploadsView: React.FC = () => {
  const styles = useStyles()
  const { queue, clearCompleted } = useUpload()
  const { t } = useLanguage()

  const hasClearable = queue.some((i) => i.status === 'Completed' || i.status === 'Cancelled')

  return (
    <div className={styles.wrapper}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Button
          size="small"
          appearance="subtle"
          icon={<DismissCircleRegular />}
          onClick={clearCompleted}
          disabled={!hasClearable}
          title="Remove all completed and cancelled entries from the list"
          style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(var(--vrcd-neon-raw),0.8)', border: '1px solid rgba(var(--vrcd-neon-raw),0.3)' }}
        >
          Clear Completed
        </Button>
      </div>
      {queue.length === 0 ? (
        <div className={styles.emptyState}>
          <Text size={200} weight="semibold">
            {t('noUploadsInQueue')}
          </Text>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t('game')}</TableHeaderCell>
              <TableHeaderCell>{t('packageName')}</TableHeaderCell>
              <TableHeaderCell>{t('version')}</TableHeaderCell>
              <TableHeaderCell>{t('status')}</TableHeaderCell>
              <TableHeaderCell>{t('actions')}</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.map((item) => (
              <UploadRow key={item.packageName} item={item} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export default UploadsView
