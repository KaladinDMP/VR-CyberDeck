import { join } from 'path'
import { promises as fs, existsSync } from 'fs'
import { app } from 'electron'
import { debounce } from './utils'
import { DownloadItem } from '@shared/types'

export class QueueManager {
  private queue: DownloadItem[] = []
  private queuePath: string
  private debouncedSaveQueue: () => void

  constructor() {
    this.queuePath = join(app.getPath('userData'), 'download-queue.json')
    // Debounce saveQueue with 'this' bound correctly
    this.debouncedSaveQueue = debounce(this.saveQueue.bind(this), 1000)
  }

  public async loadQueue(): Promise<void> {
    try {
      if (existsSync(this.queuePath)) {
        const data = await fs.readFile(this.queuePath, 'utf-8')
        const loadedQueue: DownloadItem[] = JSON.parse(data)

        // Filter out items where the download path no longer exists
        const validQueue = loadedQueue.filter((item) => {
          if (item.downloadPath && !existsSync(item.downloadPath)) {
            console.warn(
              `Download directory "${item.downloadPath}" for "${item.releaseName}" not found. Removing item from queue.`
            )
            return false // Exclude this item
          }
          return true // Keep this item
        })

        this.queue = validQueue

        // If items were removed, save the cleaned queue
        if (this.queue.length !== loadedQueue.length) {
          console.log('Saving cleaned download queue after removing items with missing paths.')
          await this.saveQueue() // Save immediately after cleaning
        }

        console.log(`Loaded ${this.queue.length} download items from queue file.`)
      } else {
        console.log('No existing download queue found.')
        this.queue = []
      }
    } catch (error) {
      // If the file doesn't exist or is invalid, start with an empty queue
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        console.log('Download queue file not found, starting fresh.')
      } else {
        console.error('Error loading download queue:', error)
      }
      this.queue = []
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      const data = JSON.stringify(this.queue, null, 2)
      await fs.writeFile(this.queuePath, data, 'utf-8')
      // console.log('Download queue saved.'); // Maybe too noisy?
    } catch (error) {
      console.error('Error saving download queue:', error)
    }
  }

  public getQueue(): DownloadItem[] {
    return [...this.queue] // Return a copy
  }

  public findItem(releaseName: string): DownloadItem | undefined {
    return this.queue.find((i) => i.releaseName === releaseName)
  }

  public findIndex(releaseName: string): number {
    return this.queue.findIndex((i) => i.releaseName === releaseName)
  }

  public findNextQueuedItem(): DownloadItem | undefined {
    return this.queue.find((item) => item.status === 'Queued')
  }

  // Move a Queued item ahead of all other Queued items so it runs next.
  // Items currently Downloading/Extracting/Installing are not displaced.
  public moveQueuedToFront(releaseName: string): boolean {
    const idx = this.findIndex(releaseName)
    if (idx === -1) return false
    const item = this.queue[idx]
    if (item.status !== 'Queued') return false

    const firstQueuedIdx = this.queue.findIndex((i) => i.status === 'Queued')
    if (firstQueuedIdx === -1 || firstQueuedIdx === idx) return false

    this.queue.splice(idx, 1)
    this.queue.splice(firstQueuedIdx, 0, item)
    this.debouncedSaveQueue()
    return true
  }

  public addItem(item: DownloadItem): void {
    // Basic add, assumes checks are done beforehand if needed
    this.queue.push(item)
    this.debouncedSaveQueue()
  }

  // Removes item by releaseName, returns true if found and removed, false otherwise
  public removeItem(releaseName: string): boolean {
    const index = this.findIndex(releaseName)
    if (index !== -1) {
      this.queue.splice(index, 1)
      this.debouncedSaveQueue()
      return true
    }
    return false
  }

  // Removes items by predicate, returns true if any items were removed
  public removeItemsWhere(predicate: (item: DownloadItem) => boolean): boolean {
    const initialLength = this.queue.length
    this.queue = this.queue.filter((item) => !predicate(item))
    const removed = this.queue.length < initialLength
    if (removed) {
      this.debouncedSaveQueue()
    }
    return removed
  }

  public updateItem(releaseName: string, updates: Partial<DownloadItem>): boolean {
    const item = this.findItem(releaseName)
    if (item) {
      Object.assign(item, updates)
      // Ensure progress stays within bounds if updated
      if (updates.progress !== undefined) {
        item.progress = Math.max(0, Math.min(100, updates.progress))
      }
      if (updates.extractProgress !== undefined) {
        item.extractProgress = Math.max(0, Math.min(100, updates.extractProgress))
      } else if (
        updates.status &&
        updates.status !== 'Extracting' &&
        updates.status !== 'Completed'
      ) {
        // Clear extractProgress unless status is Extracting or Completed
        item.extractProgress = undefined
      }

      this.debouncedSaveQueue()
      return true
    }
    return false
  }

  public updateAllItems(
    predicate: (item: DownloadItem) => boolean,
    updates: Partial<DownloadItem>
  ): boolean {
    let changed = false
    this.queue.forEach((item) => {
      if (predicate(item)) {
        Object.assign(item, updates)
        // Add bounds checks if progress/extractProgress are part of updates
        changed = true
      }
    })
    if (changed) {
      this.debouncedSaveQueue()
    }
    return changed
  }

  public getQueuePath(): string {
    return this.queuePath
  }
}
