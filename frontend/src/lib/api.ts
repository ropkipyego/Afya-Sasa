import { refreshSession } from './auth-session'
import { useAuthStore } from './auth-store'
import {
  enqueueOfflineMutation,
  isOnline,
  readOfflineCache,
  writeOfflineCache,
  type OfflineCacheKey,
} from './offline-cache'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

const OFFLINE_GET_MAP: Array<{ match: RegExp; key: OfflineCacheKey }> = [
  { match: /^\/admin\/clinical-catalog/, key: 'clinical-catalog' },
  { match: /^\/admin\/settings/, key: 'admin-settings' },
  { match: /^\/laboratory\/panels/, key: 'lab-panels' },
  { match: /^\/laboratory\/tests/, key: 'lab-tests' },
  { match: /^\/radiology\/modalities/, key: 'radiology-modalities' },
]

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const { tenant, accessToken, clearSession } = useAuthStore.getState()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('X-Tenant', tenant)

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (!isOnline()) {
    if (method === 'GET') {
      const mapped = OFFLINE_GET_MAP.find((entry) => entry.match.test(path))
      if (mapped) {
        const cached = readOfflineCache<T>(mapped.key)
        if (cached !== null) return cached
      }
    } else {
      let body: unknown
      try {
        body = options.body ? JSON.parse(String(options.body)) : undefined
      } catch {
        body = options.body
      }
      enqueueOfflineMutation(path, method, body)
      throw new Error('You are offline — change queued locally. Reconnect to sync.')
    }
    throw new Error('You are offline and no cached data is available for this request.')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && allowRefresh && !path.includes('/auth/refresh')) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return apiRequest<T>(path, options, false)
    }
    clearSession()
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }))
    const message =
      typeof error.message === 'string'
        ? error.message
        : Array.isArray(error.message)
          ? error.message.join(', ')
          : error.error?.message ?? 'Request failed'
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data = (await response.json()) as T
  if (method === 'GET') {
    const mapped = OFFLINE_GET_MAP.find((entry) => entry.match.test(path))
    if (mapped) writeOfflineCache(mapped.key, data)
  }
  return data
}
