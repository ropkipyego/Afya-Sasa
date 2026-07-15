/**
 * Offline-capable cache for key catalogs and recent worklists.
 * Uses localStorage + ephemeral memory; syncs when online returns.
 */

const PREFIX = 'afyasasa-offline:'

export type OfflineCacheKey =
  | 'clinical-catalog'
  | 'lab-panels'
  | 'lab-tests'
  | 'radiology-modalities'
  | 'admin-settings'
  | 'nav-snapshot'

type CacheEntry<T> = {
  savedAt: string
  data: T
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function writeOfflineCache<T>(key: OfflineCacheKey, data: T) {
  try {
    const entry: CacheEntry<T> = { savedAt: new Date().toISOString(), data }
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(entry))
  } catch {
    // Quota or private mode — ignore
  }
}

export function readOfflineCache<T>(key: OfflineCacheKey, maxAgeMs = 24 * 60 * 60 * 1000): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() - new Date(entry.savedAt).getTime() > maxAgeMs) return null
    return entry.data
  } catch {
    return null
  }
}

export function clearOfflineCache() {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) keys.push(key)
  }
  keys.forEach((key) => localStorage.removeItem(key))
}

/** Queue mutations while offline for later flush (best-effort). */
const QUEUE_KEY = `${PREFIX}mutation-queue`

export function enqueueOfflineMutation(path: string, method: string, body?: unknown) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Array<{
      path: string
      method: string
      body?: unknown
      at: string
    }>
    queue.push({ path, method, body, at: new Date().toISOString() })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-50)))
  } catch {
    // ignore
  }
}

export function peekOfflineMutations() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Array<{
      path: string
      method: string
      body?: unknown
      at: string
    }>
  } catch {
    return []
  }
}

export function clearOfflineMutations() {
  localStorage.removeItem(QUEUE_KEY)
}
