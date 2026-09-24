import { apiRequest } from './api'
import { useAuthStore, type UserProfile } from './auth-store'
import { getCachedSessionPolicy } from './session-policy'

let refreshTimer: ReturnType<typeof setInterval> | null = null
let backgroundRevalidatePromise: Promise<void> | null = null
let ending = false

export async function fetchCurrentUser(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/auth/me')
}

export async function refreshSession(): Promise<boolean> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState()

  try {
    const result = await apiRequest<{
      accessToken: string
      refreshToken?: string
      user?: UserProfile
    }>(
      '/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      },
      false,
    )

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

export async function endSession(reason: 'user' | 'inactivity' = 'user'): Promise<void> {
  if (ending) return
  ending = true
  const { refreshToken, clearSession } = useAuthStore.getState()
  try {
    await apiRequest(
      '/auth/logout',
      {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: refreshToken ?? undefined,
          reason,
        }),
      },
      false,
    )
  } catch {
    // Cookie/session may already be gone.
  } finally {
    clearSession()
    ending = false
  }
}

async function revalidateSessionInBackground() {
  if (backgroundRevalidatePromise) return backgroundRevalidatePromise

  backgroundRevalidatePromise = (async () => {
    try {
      const user = await fetchCurrentUser()
      useAuthStore.getState().setUser(user)
    } catch {
      const refreshed = await refreshSession()
      if (!refreshed) {
        useAuthStore.getState().clearSession()
      }
    } finally {
      backgroundRevalidatePromise = null
    }
  })()

  return backgroundRevalidatePromise
}

export async function bootstrapAuthSession(): Promise<void> {
  const store = useAuthStore.getState()
  if (!store.accessToken && !store.refreshToken && !store.user) {
    store.setHydrated(true)
    return
  }

  if (store.accessToken && store.user) {
    store.setHydrated(true)
    void revalidateSessionInBackground()
    return
  }

  try {
    if (!store.accessToken) {
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
  const interval = Math.max(
    30_000,
    (getCachedSessionPolicy().accessTokenTtlSeconds - 180) * 1000,
  )
  refreshTimer = setInterval(() => {
    void refreshSession()
  }, interval)
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
    useAuthStore.getState().syncFromStorage()
  })
}
