import { apiRequest } from './api'

export type SessionPolicy = {
  inactivityTimeoutSeconds: number
  inactivityWarningSeconds: number
  accessTokenTtlSeconds: number
}

const DEFAULT_POLICY: SessionPolicy = {
  inactivityTimeoutSeconds: 300,
  inactivityWarningSeconds: 60,
  accessTokenTtlSeconds: 900,
}

let cached: SessionPolicy | null = null

export function getCachedSessionPolicy(): SessionPolicy {
  return cached ?? DEFAULT_POLICY
}

export async function loadSessionPolicy(): Promise<SessionPolicy> {
  try {
    cached = await apiRequest<SessionPolicy>('/auth/session-policy', {}, false)
    return cached
  } catch {
    cached = DEFAULT_POLICY
    return cached
  }
}
