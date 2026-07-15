import { useEffect } from 'react'
import {
  bootstrapAuthSession,
  startSessionRefreshLoop,
  stopSessionRefreshLoop,
  syncAuthAcrossTabs,
} from '../lib/auth-session'
import { useAuthStore } from '../lib/auth-store'

export function useAuthSession() {
  const hydrated = useAuthStore((state) => state.hydrated)
  const accessToken = useAuthStore((state) => state.accessToken)

  useEffect(() => {
    syncAuthAcrossTabs()
    void bootstrapAuthSession()
  }, [])

  useEffect(() => {
    if (accessToken) {
      startSessionRefreshLoop()
      return () => stopSessionRefreshLoop()
    }
    stopSessionRefreshLoop()
    return undefined
  }, [accessToken])

  return { hydrated, isAuthenticated: Boolean(accessToken) }
}
