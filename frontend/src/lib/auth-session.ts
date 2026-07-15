import { apiRequest } from './api'
import { useAuthStore, type UserProfile } from './auth-store'

const REFRESH_INTERVAL_MS = 12 * 60 * 1000

let refreshTimer: ReturnType<typeof setInterval> | null = null

export async function fetchCurrentUser(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/auth/me')
}

export async function refreshSession(): Promise<boolean> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState()
  if (!refreshToken) {
    clearSession()
    return false
  }

  try {
    const result = await apiRequest<{
      accessToken: string
      refreshToken?: string
      user?: UserProfile
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }, false)

    setSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    })
    return true
  } catch {
    clearSession()
    return false
  }
}

export async function bootstrapAuthSession(): Promise<void> {
  const store = useAuthStore.getState()
  if (!store.accessToken && !store.refreshToken) {
    store.setHydrated(true)
    return
  }

  try {
    if (!store.accessToken && store.refreshToken) {
      const refreshed = await refreshSession()
      if (!refreshed) {
        store.clearSession()
        return
      }
    }

    const { accessToken, refreshToken } = useAuthStore.getState()
    if (accessToken) {
      const user = await fetchCurrentUser()
      store.setSession({ accessToken, refreshToken: refreshToken ?? undefined, user })
    }
  } catch {
    if (!(await refreshSession())) {
      store.clearSession()
    } else {
      try {
        const user = await fetchCurrentUser()
        const { accessToken, refreshToken } = useAuthStore.getState()
        store.setSession({ accessToken: accessToken!, refreshToken: refreshToken ?? undefined, user })
      } catch {
        store.clearSession()
      }
    }
  } finally {
    store.setHydrated(true)
  }
}

export function startSessionRefreshLoop() {
  stopSessionRefreshLoop()
  refreshTimer = setInterval(() => {
    void refreshSession()
  }, REFRESH_INTERVAL_MS)
}

export function stopSessionRefreshLoop() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

export function syncAuthAcrossTabs() {
  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith('afyasasa.')) return
    const store = useAuthStore.getState()
    store.syncFromStorage()
  })
}
