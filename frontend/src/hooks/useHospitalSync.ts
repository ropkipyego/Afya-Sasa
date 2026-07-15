import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../lib/auth-store'

const SYNC_QUERY_PREFIXES = [
  'ipd-dashboard',
  'ward-census',
  'vitals',
  'mar',
  'nursing-admissions',
  'admissions',
  'bed-dashboard',
  'available-beds',
  'ipd-workspace',
  'triage-queue',
  'encounters',
  'lab-requests',
  'radiology-requests',
  'clinical-catalog',
  'admin-settings',
  'patient-timeline',
  'notification-inbox',
  'notification-summary',
  'system-health',
  'worklist',
  'worklists-catalog',
  'module-patients',
  'emergency-metrics',
  'emergency-queue',
  'emergency-bays',
  'emergency-alerts',
  'clinical-orders',
  'nursing-observations',
  'shift-notes',
]

function invalidateClinicalQueries(queryClient: ReturnType<typeof useQueryClient>) {
  for (const prefix of SYNC_QUERY_PREFIXES) {
    void queryClient.invalidateQueries({ queryKey: [prefix] })
  }
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0]
      return typeof key === 'string' && SYNC_QUERY_PREFIXES.some((prefix) => key.startsWith(prefix))
    },
  })
}

/**
 * Keeps clinical workspaces fresh: 15s polling, refetch on window focus,
 * and Socket.IO when socket.io-client is installed.
 */
export function useHospitalSync() {
  const queryClient = useQueryClient()
  const tenant = useAuthStore((state) => state.tenant)

  useEffect(() => {
    const onFocus = () => invalidateClinicalQueries(queryClient)
    window.addEventListener('focus', onFocus)

    const interval = window.setInterval(() => {
      invalidateClinicalQueries(queryClient)
    }, 15_000)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [queryClient])

  useEffect(() => {
    let socket: { disconnect: () => void } | null = null
    let cancelled = false

    async function connectRealtime() {
      try {
        const moduleName = 'socket.io-client'
        const socketModule = await import(/* @vite-ignore */ moduleName)
        if (cancelled || !socketModule?.io) return

        const origin = window.location.origin
        const socketUrl = import.meta.env.VITE_SOCKET_URL ?? origin

        const instance = socketModule.io(`${socketUrl}/realtime`, {
          transports: ['websocket', 'polling'],
          query: { tenant },
        })

        const handleSync = () => invalidateClinicalQueries(queryClient)
        instance.on('sync', handleSync)
        instance.on('vitals.recorded', handleSync)
        instance.on('admission.created', handleSync)
        instance.on('admission.updated', handleSync)
        instance.on('admission.discharged', handleSync)
        instance.on('bed.updated', handleSync)
        instance.on('settings.updated', handleSync)
        instance.on('lab.updated', handleSync)
        instance.on('radiology.updated', handleSync)
        instance.on('triage.updated', handleSync)
        instance.on('notification.created', handleSync)
        instance.on('emergency.alert', handleSync)

        socket = instance
      } catch {
        // Polling fallback remains active
      }
    }

    void connectRealtime()

    return () => {
      cancelled = true
      socket?.disconnect()
    }
  }, [queryClient, tenant])
}
