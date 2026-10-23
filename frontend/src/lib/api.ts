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
const DEFAULT_TIMEOUT_MS = 30_000

export class ApiRequestError extends Error {
  status: number
  code?: string
  requestId?: string | null
  details?: string
  timedOut?: boolean
  networkFailure?: boolean
  retryable?: boolean
  nextAction?: string
  fields?: Record<string, string>

  constructor(
    message: string,
    status: number,
    extras?: {
      code?: string
      requestId?: string | null
      details?: string
      timedOut?: boolean
      networkFailure?: boolean
      retryable?: boolean
      nextAction?: string
      fields?: Record<string, string>
    },
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = extras?.code
    this.requestId = extras?.requestId
    this.details = extras?.details
    this.timedOut = extras?.timedOut
    this.networkFailure = extras?.networkFailure
    this.retryable = extras?.retryable
    this.nextAction = extras?.nextAction
    this.fields = extras?.fields
  }
}

export function getApiErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiRequestError) return error.status
  return undefined
}

function withReference(text: string, requestId?: string | null) {
  const id = requestId?.trim()
  return id ? `${text} Reference: ${id}.` : text
}

export function formatApiError(error: unknown, fallback: string): string {
  const requestId = error instanceof ApiRequestError ? error.requestId : null
  if (error instanceof ApiRequestError && error.timedOut) {
    return withReference('The request timed out. Check your connection and retry.', requestId)
  }
  if (error instanceof ApiRequestError && error.networkFailure) {
    return withReference('Unable to reach the hospital server. Check the connection and try again.', requestId)
  }
  const status = getApiErrorStatus(error)
  const message = error instanceof Error ? error.message : fallback
  const next = error instanceof ApiRequestError ? error.nextAction : undefined
  const fieldText =
    error instanceof ApiRequestError && error.fields
      ? Object.entries(error.fields)
          .map(([field, text]) => `${field}: ${text}`)
          .join(' ')
      : ''
  const body = [message, next, fieldText].filter(Boolean).join(' ')
  if (status === 401) return 'Your session expired. Sign in again.'
  if (status === 403) return body || 'You do not have permission to perform this action.'
  if (status === 404) return body || 'The requested record could not be found.'
  if (status === 409 || status === 422 || status === 400) {
    return body || 'This action could not be completed.'
  }
  if (status === 429) return withReference('Too many requests. Please wait and try again.', requestId)
  if (status === 502 || status === 503) {
    return withReference('The service is temporarily unavailable. Please retry.', requestId)
  }
  if (status && status >= 500) {
    return withReference(fallback || 'The server could not complete this request.', requestId)
  }
  return body
}

const OFFLINE_GET_MAP: Array<{ match: RegExp; key: OfflineCacheKey }> = [
  { match: /^\/admin\/clinical-catalog/, key: 'clinical-catalog' },
  { match: /^\/admin\/settings/, key: 'admin-settings' },
  { match: /^\/laboratory\/panels/, key: 'lab-panels' },
  { match: /^\/laboratory\/tests/, key: 'lab-tests' },
  { match: /^\/radiology\/modalities/, key: 'radiology-modalities' },
]

function newRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type ApiRequestInit = RequestInit & {
  timeoutMs?: number
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const { tenant, accessToken, clearSession } = useAuthStore.getState()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('X-Tenant', tenant)
  const requestId = headers.get('X-Request-Id') ?? newRequestId()
  headers.set('X-Request-Id', requestId)

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
      throw new ApiRequestError(
        'You are offline — change queued locally. Reconnect to sync.',
        0,
        { code: 'OFFLINE_QUEUED', requestId, networkFailure: true },
      )
    }
    throw new ApiRequestError(
      'Unable to reach the hospital server. Check the connection and try again.',
      0,
      { code: 'NETWORK_UNAVAILABLE', requestId, networkFailure: true },
    )
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError(
        'The request is taking too long and could not be completed.',
        0,
        { code: 'REQUEST_TIMEOUT', requestId, timedOut: true },
      )
    }
    throw new ApiRequestError(
      'Unable to reach the hospital server. Check the connection and try again.',
      0,
      { code: 'NETWORK_UNAVAILABLE', requestId, networkFailure: true },
    )
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 401 && allowRefresh && !path.includes('/auth/refresh')) {
    const generation = useAuthStore.getState().authGeneration
    const refreshed = await refreshSession()
    if (refreshed) {
      return apiRequest<T>(path, options, false)
    }
    if (useAuthStore.getState().authGeneration !== generation) {
      return apiRequest<T>(path, options, false)
    }
    clearSession()
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }))
    const envelopeMessage =
      typeof error?.error?.message === 'string' ? error.error.message : undefined
    const legacyMessage =
      typeof error.message === 'string'
        ? error.message
        : Array.isArray(error.message)
          ? error.message.join(', ')
          : undefined
    const message = envelopeMessage ?? legacyMessage ?? 'Request failed'
    throw new ApiRequestError(message, response.status, {
      code: typeof error?.error?.code === 'string' ? error.error.code : undefined,
      details: typeof error?.error?.details === 'string' ? error.error.details : undefined,
      requestId: typeof error?.requestId === 'string' ? error.requestId : requestId,
      retryable: Boolean(error?.error?.retryable),
      nextAction: typeof error?.error?.nextAction === 'string' ? error.error.nextAction : undefined,
      fields:
        error?.error?.fields && typeof error.error.fields === 'object'
          ? (error.error.fields as Record<string, string>)
          : undefined,
    })
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
