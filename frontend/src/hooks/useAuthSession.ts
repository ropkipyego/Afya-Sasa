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
          `This workstation will sign out in ${seconds}s because nobody is using it. Move the mouse or press a key to stay signed in.`,
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
