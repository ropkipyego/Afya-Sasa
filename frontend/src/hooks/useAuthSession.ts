import { useEffect } from 'react'
import {
  bootstrapAuthSession,
  startSessionRefreshLoop,
  stopSessionRefreshLoop,
  syncAuthAcrossTabs,
} from '../lib/auth-session'
import { startInactivityWatch, stopInactivityWatch } from '../lib/inactivity'
import { useAuthStore } from '../lib/auth-store'

export function useAuthSession() {
  const hydrated = useAuthStore((state) => state.hydrated)
  const accessToken = useAuthStore((state) => state.accessToken)
  const setInactivityWarning = useAuthStore((state) => state.setInactivityWarning)

  useEffect(() => {
    syncAuthAcrossTabs()
    void bootstrapAuthSession()
  }, [])

  useEffect(() => {
    if (accessToken) {
      startSessionRefreshLoop()
      startInactivityWatch((state) => {
        if (!state.warning) {
          setInactivityWarning(null)
          return
        }
        const seconds = Math.max(1, Math.ceil(state.remainingMs / 1000))
        setInactivityWarning(
          `You have been inactive. You will be logged out in ${seconds} seconds.`,
        )
      })
      return () => {
        stopSessionRefreshLoop()
        stopInactivityWatch()
      }
    }
    stopSessionRefreshLoop()
    stopInactivityWatch()
    setInactivityWarning(null)
    return undefined
  }, [accessToken, setInactivityWarning])

  return { hydrated, isAuthenticated: Boolean(accessToken) }
}
