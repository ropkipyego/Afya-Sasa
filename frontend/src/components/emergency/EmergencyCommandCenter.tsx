import { useEffect, useMemo, useRef, useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, HeartPulse, Users } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, PageHeader, SelectField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { EmergencyPatientWorkspace } from './EmergencyPatientWorkspace'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { playEmergencyAlertSound } from '../../lib/emergency-alert-sound'

type EmergencyMetrics = {
  totalToday: number
  waiting: number
  critical: number
  inResuscitation: number
  awaitingDoctor: number
  awaitingAdmission: number
  awaitingTransfer: number
  awaitingDischarge: number
}

type QueueItem = {
  id: string
  arrivalTime: string
  triageCategory: string | null
  workflowStage: string
  chiefComplaint: string | null
  resuscitationFlag: boolean
  encounter: {
    patient: { id: string; firstName: string; lastName: string; patientNo: string; dateOfBirth: string; gender: string }
  }
}

type BayBoard = {
  id: string
  name: string
  code: string
  bayType: string
  status: string
  occupant: {
    emergencyId: string
    patientName: string
    triageCategory: string | null
    workflowStage: string
    arrivalTime: string
  } | null
}

type CriticalAlertItem = {
  id: string
  type: string
  severity: string
  message: string
  createdAt: string
  acknowledgedAt: string | null
}

const triageTone: Record<string, string> = {
  red: 'border-red-500 bg-red-50 text-red-900',
  orange: 'border-orange-500 bg-orange-50 text-orange-900',
  yellow: 'border-yellow-500 bg-yellow-50 text-yellow-900',
  green: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  black: 'border-slate-700 bg-slate-900 text-white',
}

const triageLabel: Record<string, string> = {
  red: 'RED — Immediate',
  orange: 'ORANGE — Very urgent',
  yellow: 'YELLOW — Urgent',
  green: 'GREEN — Minor',
  black: 'BLACK — Deceased',
}

function waitMinutes(arrivalTime: string) {
  return Math.max(0, Math.round((Date.now() - new Date(arrivalTime).getTime()) / 60_000))
}

export function EmergencyCommandCenter() {
  const queryClient = useQueryClient()
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [openEmergencyId, setOpenEmergencyId] = useState<string | null>(null)

  const { data: metrics } = useQuery({
    queryKey: ['emergency-metrics'],
    queryFn: () => apiRequest<EmergencyMetrics>('/emergency/metrics'),
    refetchInterval: 15_000,
  })

  const { data: queue = [] } = useQuery({
    queryKey: ['emergency-queue'],
    queryFn: () => apiRequest<QueueItem[]>('/emergency/queue'),
    refetchInterval: 15_000,
  })

  const { data: bays = [] } = useQuery({
    queryKey: ['emergency-bays'],
    queryFn: () => apiRequest<BayBoard[]>('/emergency/bays'),
    refetchInterval: 15_000,
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['emergency-alerts'],
    queryFn: () => apiRequest<CriticalAlertItem[]>('/emergency/alerts'),
    refetchInterval: 10_000,
  })

  const previousAlertCount = useRef(0)
  useEffect(() => {
    const active = alerts.filter((a) => !a.acknowledgedAt)
    if (active.length > previousAlertCount.current) {
      playEmergencyAlertSound()
      notify('Emergency alert', active[0]?.message ?? 'Critical ED alert', 'critical')
    }
    previousAlertCount.current = active.length
  }, [alerts])

  const acknowledgeAlert = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/emergency/alerts/${id}/acknowledge`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emergency-alerts'] })
    },
  })

  const register = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest<{ id: string }>('/emergency/register', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          presentingComplaint: form.get('presentingComplaint'),
          arrivalMode: form.get('arrivalMode'),
          traumaFlag: form.get('traumaFlag') === 'on',
          resuscitationFlag: form.get('resuscitationFlag') === 'on',
        }),
      })
    },
    onSuccess: async (row) => {
      notify('Emergency arrival registered', 'Patient added to ED queue.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['emergency-metrics'] })
      await queryClient.invalidateQueries({ queryKey: ['emergency-queue'] })
      setOpenEmergencyId(row.id)
    },
  })

  const metricCards = useMemo(
    () => [
      { label: 'Patients today', value: metrics?.totalToday ?? 0, icon: Users },
      { label: 'Waiting', value: metrics?.waiting ?? 0, icon: Clock },
      { label: 'Critical', value: metrics?.critical ?? 0, icon: AlertTriangle },
      { label: 'Resuscitation', value: metrics?.inResuscitation ?? 0, icon: HeartPulse },
      { label: 'Awaiting doctor', value: metrics?.awaitingDoctor ?? 0, icon: Users },
      { label: 'Awaiting admission', value: metrics?.awaitingAdmission ?? 0, icon: Users },
      { label: 'Awaiting transfer', value: metrics?.awaitingTransfer ?? 0, icon: Users },
      { label: 'Awaiting discharge', value: metrics?.awaitingDischarge ?? 0, icon: Users },
    ],
    [metrics],
  )

  const triageCounts = useMemo(() => {
    const counts = { red: 0, orange: 0, yellow: 0, green: 0, black: 0, untriaged: 0 }
    for (const item of queue) {
      if (!item.triageCategory) counts.untriaged += 1
      else if (item.triageCategory in counts) counts[item.triageCategory as keyof typeof counts] += 1
    }
    return counts
  }, [queue])

  const observationCount = useMemo(
    () => queue.filter((q) => q.workflowStage === 'observation').length,
    [queue],
  )

  if (openEmergencyId) {
    return (
      <EmergencyPatientWorkspace
        emergencyId={openEmergencyId}
        onBack={() => {
          setOpenEmergencyId(null)
          void queryClient.invalidateQueries({ queryKey: ['emergency-queue'] })
        }}
      />
    )
  }

  return (
    <div className="workspace-shell animate-fade-in">
      <PageHeader
        title="Emergency Department"
        description="Arrival → triage → treatment bay → assessment → investigations → observation → outcome"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {metricCards.map((m) => (
          <div key={m.label} className="card-hover rounded-2xl border border-red-200 bg-red-50/40 p-5">
            <m.icon className="mb-2 h-5 w-5 text-red-600" />
            <p className="text-[10px] font-bold uppercase text-slate-600">{m.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      {alerts.filter((a) => !a.acknowledgedAt).length ? (
        <Card className="border-rose-300 bg-rose-50 p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-rose-900">
            <AlertTriangle className="h-4 w-4" />
            Live critical alerts
          </h3>
          <ul className="mt-3 space-y-2">
            {alerts
              .filter((a) => !a.acknowledgedAt)
              .map((alert) => (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-rose-900">{alert.message}</p>
                    <p className="text-xs text-rose-700">
                      {alert.severity} · {alert.type} · {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => acknowledgeAlert.mutate(alert.id)}
                  >
                    Acknowledge
                  </Button>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Triage breakdown</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {(
            [
              ['red', 'Immediate'],
              ['orange', 'Very urgent'],
              ['yellow', 'Urgent'],
              ['green', 'Minor'],
              ['black', 'Deceased'],
              ['untriaged', 'Awaiting triage'],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className={clsx(
                'rounded-2xl border p-4',
                key !== 'untriaged' ? triageTone[key] : 'border-amber-300 bg-amber-50 text-amber-900',
              )}
            >
              <p className="text-[10px] font-bold uppercase opacity-80">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{triageCounts[key]}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-500">
          Under observation: <strong>{observationCount}</strong> · Admissions pending:{' '}
          <strong>{metrics?.awaitingAdmission ?? 0}</strong> · Transfers pending:{' '}
          <strong>{metrics?.awaitingTransfer ?? 0}</strong>
        </p>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card className="p-5 md:p-8">
            <PageHeader title="Emergency arrival" description="Search patient — no manual IDs." />
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                register.mutate(e.currentTarget)
              }}
            >
              <PatientSearchAutocomplete selected={selectedPatient} onSelect={setSelectedPatient} />
              <textarea
                name="presentingComplaint"
                className="input min-h-[4rem]"
                placeholder="Chief complaint / presenting problem"
                required
              />
              <SelectField name="arrivalMode" label="Arrival mode" required defaultValue="walk_in">
                <option value="walk_in">Walk-in</option>
                <option value="ambulance">Ambulance</option>
                <option value="police">Police</option>
                <option value="referral">Referral</option>
                <option value="airlift">Airlift</option>
              </SelectField>
              <label className="flex items-center gap-2 text-sm">
                <input name="traumaFlag" type="checkbox" /> Trauma case
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input name="resuscitationFlag" type="checkbox" /> Resuscitation required
              </label>
              <Button type="submit" loading={register.isPending} disabled={!selectedPatient}>
                Register arrival
              </Button>
            </form>
          </Card>

          <Card className="p-5 md:p-8">
            <PageHeader title="Treatment bays" description="Assign patients after triage." />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {bays.map((bay) => (
                <div
                  key={bay.id}
                  className={clsx(
                    'rounded-2xl border p-5',
                    bay.occupant ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50',
                  )}
                >
                  <p className="text-sm font-bold">{bay.name}</p>
                  <p className="text-xs capitalize text-slate-500">{bay.bayType.replace('_', ' ')}</p>
                  {bay.occupant ? (
                    <button
                      type="button"
                      className="mt-2 w-full text-left"
                      onClick={() => setOpenEmergencyId(bay.occupant!.emergencyId)}
                    >
                      <p className="text-sm font-semibold">{bay.occupant.patientName}</p>
                      <p className="text-xs text-slate-500">
                        {bay.occupant.triageCategory?.toUpperCase() ?? '—'} · {waitMinutes(bay.occupant.arrivalTime)}m
                      </p>
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-emerald-700">Available</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-5 md:p-8">
          <PageHeader title="Emergency queue" description="Critical patients always on top." />
          <div className="mt-6 max-h-[40rem] space-y-3 overflow-y-auto">
            {queue.map((item) => {
              const patient = item.encounter.patient
              const tone = item.triageCategory ? triageTone[item.triageCategory] : 'border-slate-200 bg-white'
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOpenEmergencyId(item.id)}
                  className={clsx('card-hover w-full rounded-2xl border p-5 text-left', tone)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-xs opacity-80">
                        {patient.patientNo} · {item.workflowStage.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold">
                      {waitMinutes(item.arrivalTime)}m
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{item.chiefComplaint ?? 'No complaint recorded'}</p>
                  {item.triageCategory ? (
                    <p className="mt-1 text-xs font-bold uppercase">{triageLabel[item.triageCategory]}</p>
                  ) : (
                    <p className="mt-1 text-xs font-semibold text-amber-700">Awaiting triage</p>
                  )}
                </button>
              )
            })}
            {!queue.length ? <p className="py-8 text-center text-sm text-slate-500">No active emergency patients.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
