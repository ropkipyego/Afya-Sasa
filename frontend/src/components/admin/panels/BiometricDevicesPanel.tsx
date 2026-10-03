import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Field, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import { biometricDeviceStatus, readerStateLabel } from '../../../lib/biometric-agent'

type Device = {
  id: string
  deviceKey: string
  name: string
  provider: string
  location: string | null
  status: string
  agentVersion: string | null
  lastHeartbeatAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
}

export function BiometricDevicesPanel() {
  const queryClient = useQueryClient()
  const { data: status } = useQuery({
    queryKey: ['biometric-status'],
    queryFn: () => apiRequest<Record<string, unknown>>('/biometrics/status'),
  })
  const { data: localReader } = useQuery({
    queryKey: ['biometric-local-reader'],
    queryFn: () => biometricDeviceStatus(),
    refetchInterval: 15_000,
  })
  const { data: devices = [] } = useQuery({
    queryKey: ['biometric-devices'],
    queryFn: () => apiRequest<Device[]>('/biometrics/devices'),
  })
  const register = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = new FormData(form)
      return apiRequest<Device & { deviceSecret?: string }>('/biometrics/devices', {
        method: 'POST',
        body: JSON.stringify({
          name: data.get('name'),
          location: data.get('location') || undefined,
          deviceKey: data.get('deviceKey') || undefined,
        }),
      })
    },
    onSuccess: (device) => {
      notify(
        'Workstation registered',
        device.deviceSecret
          ? `Store this secret on the workstation only: ${device.deviceSecret}`
          : 'Device created.',
        'success',
      )
      void queryClient.invalidateQueries({ queryKey: ['biometric-devices'] })
    },
    onError: (error: Error) => notify('Device registration failed', error.message, 'critical'),
  })
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest(`/biometrics/devices/${id}/enabled`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['biometric-devices'] }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="DigitalPersona 4500 workstations"
        description="Hospital-owned fingerprint readers. Capture runs on the local agent, not in the browser."
      />
      <Alert tone="info">
        This is Jalaram identity verification. It is not DHA HealthID consent. Manual patient
        search stays available when the reader is offline.
      </Alert>
      <Card className="p-4 text-sm text-slate-600">
        Provider {String(status?.provider ?? 'digitalpersona_4500')} · templates{' '}
        {String(status?.templateStorage ?? 'external_subject_id_only')}
        <p className="mt-2 font-semibold text-slate-800">
          This workstation reader: {readerStateLabel(localReader?.sdk)}
        </p>
        {localReader?.lastError ? <p className="mt-1 text-xs text-amber-700">{localReader.lastError}</p> : null}
      </Card>
      <Card className="p-5">
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault()
            register.mutate(event.currentTarget)
          }}
        >
          <Field name="name" label="Workstation name" required />
          <Field name="location" label="Location" placeholder="Reception" />
          <Field name="deviceKey" label="Device key (optional)" />
          <div className="sm:col-span-3">
            <Button type="submit" loading={register.isPending}>
              Register workstation
            </Button>
          </div>
        </form>
      </Card>
      <div className="space-y-2">
        {devices.map((device) => (
          <Card key={device.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{device.name}</p>
              <p className="text-xs text-slate-500">
                {device.deviceKey} · {device.location || 'No location'} · {device.status}
              </p>
              <p className="text-xs text-slate-500">
                Heartbeat {device.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).toLocaleString() : 'never'}
                {device.lastError ? ` · ${device.lastError}` : ''}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => toggle.mutate({ id: device.id, enabled: device.status === 'disabled' })}
            >
              {device.status === 'disabled' ? 'Enable' : 'Disable'}
            </Button>
          </Card>
        ))}
        {!devices.length ? <p className="text-sm text-slate-500">No workstations registered.</p> : null}
      </div>
    </div>
  )
}
