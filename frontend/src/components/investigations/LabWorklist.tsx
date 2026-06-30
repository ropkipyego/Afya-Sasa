import { useMemo, useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, FlaskConical, TestTube, User } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, Field, PageHeader, SelectField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { ClinicalInvestigationOrders } from './ClinicalInvestigationOrders'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type LabRequestRow = {
  id: string
  status: string
  priority: string
  createdAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
  items?: { id: string; status: string; test?: { name: string }; panel?: { name: string } }[]
}

const stages = [
  { id: 'requested', label: 'Requested', tone: 'border-sky-200 bg-sky-50' },
  { id: 'sample_collected', label: 'Collected', tone: 'border-amber-200 bg-amber-50' },
  { id: 'processing', label: 'Processing', tone: 'border-violet-200 bg-violet-50' },
  { id: 'resulted', label: 'Completed', tone: 'border-teal-200 bg-teal-50' },
  { id: 'verified', label: 'Verified', tone: 'border-emerald-200 bg-emerald-50' },
] as const

function waitLabel(createdAt: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000))
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function LabWorklist() {
  const queryClient = useQueryClient()
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showNewRequest, setShowNewRequest] = useState(false)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['lab-requests'],
    queryFn: () => apiRequest<LabRequestRow[]>('/laboratory/requests'),
    refetchInterval: 20_000,
  })

  const { data: critical = [] } = useQuery({
    queryKey: ['critical-results'],
    queryFn: () => apiRequest<{ id: string }[]>('/laboratory/results/critical'),
    refetchInterval: 20_000,
  })

  const active = requests.find((r) => r.id === activeId) ?? null

  const { data: activeDetail } = useQuery({
    queryKey: ['lab-request', active?.id],
    queryFn: () => apiRequest<LabRequestRow>(`/laboratory/requests/${active!.id}`),
    enabled: Boolean(active?.id),
  })

  const activeRequest = activeDetail ?? active

  const refreshClinical = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lab-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['lab-request'] }),
      queryClient.invalidateQueries({ queryKey: ['notification-inbox'] }),
      queryClient.invalidateQueries({ queryKey: ['notification-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['critical-results'] }),
    ])
  }

  const collectSample = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest(`/laboratory/requests/${requestId}/samples`, {
        method: 'POST',
        body: JSON.stringify({ type: 'blood' }),
      }),
    onSuccess: refreshClinical,
  })

  const enterResult = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/laboratory/results', {
        method: 'POST',
        body: JSON.stringify({
          requestItemId: form.get('requestItemId'),
          value: form.get('value'),
          unit: form.get('unit') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Result saved', 'Critical values alert clinicians immediately.', 'success')
      await refreshClinical()
    },
  })

  const verifyRequest = useMutation({
    mutationFn: (requestId: string) =>
      apiRequest(`/laboratory/requests/${requestId}/verify`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Results verified', 'Doctor notified in inbox.', 'success')
      await refreshClinical()
      setActiveId(null)
    },
  })

  const byStage = useMemo(() => {
    const map: Record<string, LabRequestRow[]> = {}
    for (const s of stages) map[s.id] = []
    for (const r of requests) {
      if (map[r.status]) map[r.status].push(r)
      else map.requested?.push(r)
    }
    return map
  }, [requests])

  return (
    <div className="workspace-shell animate-fade-in">
      <PageHeader
        title="Laboratory operations"
        description="Card worklist — requested → collected → processing → completed → verified"
        actions={
          <Button type="button" variant="secondary" onClick={() => setShowNewRequest((v) => !v)}>
            New request
          </Button>
        }
      />

      {critical.length ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{critical.length} critical result(s) require clinician review.</p>
        </div>
      ) : null}

      {showNewRequest ? (
        <Card className="p-5 md:p-6">
          <PageHeader title="New laboratory request" description="Auto-links to active visit or admission." />
          <div className="mt-4 space-y-4">
            <PatientSearchAutocomplete selected={selectedPatient} onSelect={setSelectedPatient} />
            {selectedPatient ? (
              <ClinicalInvestigationOrders
                compact
                defaultMode="lab"
                context={{
                  patientId: selectedPatient.id,
                  patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                }}
                onSuccess={async () => {
                  await queryClient.invalidateQueries({ queryKey: ['lab-requests'] })
                  setShowNewRequest(false)
                }}
              />
            ) : null}
          </div>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="lab-kanban">
          {stages.map((s) => (
            <div key={s.id} className="h-64 animate-skeleton rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="lab-kanban">
          {stages.map((stage) => (
            <div key={stage.id} className={clsx('rounded-2xl border p-4', stage.tone)}>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{stage.label}</p>
                <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold tabular-nums">
                  {byStage[stage.id]?.length ?? 0}
                </span>
              </div>
              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {(byStage[stage.id] ?? []).map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => setActiveId(req.id)}
                    className={clsx(
                      'card-hover w-full rounded-xl border bg-white p-4 text-left shadow-sm',
                      activeId === req.id ? 'border-teal-400 ring-2 ring-teal-100' : 'border-slate-200',
                    )}
                  >
                    <p className="font-semibold text-slate-900">
                      {req.patient ? `${req.patient.firstName} ${req.patient.lastName}` : 'Unknown'}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <User className="h-3 w-3" />
                      {req.patient?.patientNo ?? '—'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold capitalize">{req.priority}</span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Clock className="h-3 w-3" />
                        {waitLabel(req.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
                {!byStage[stage.id]?.length ? (
                  <p className="py-6 text-center text-xs text-slate-500">No items</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeRequest ? (
        <Card className="border-2 border-teal-200 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-teal-600" />
              <div>
                <p className="font-bold text-slate-900">
                  {activeRequest.patient
                    ? `${activeRequest.patient.firstName} ${activeRequest.patient.lastName}`
                    : 'Lab request'}
                </p>
                <p className="text-sm capitalize text-slate-500">{activeRequest.status.replace('_', ' ')}</p>
              </div>
            </div>
            <Button type="button" variant="ghost" onClick={() => setActiveId(null)}>Close</Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {activeRequest.status === 'requested' ? (
              <Button type="button" onClick={() => collectSample.mutate(activeRequest.id)} loading={collectSample.isPending}>
                <TestTube className="h-4 w-4" />
                Mark sample collected
              </Button>
            ) : null}
            {['resulted', 'processing', 'sample_collected'].includes(activeRequest.status) ? (
              <Button type="button" onClick={() => verifyRequest.mutate(activeRequest.id)} loading={verifyRequest.isPending}>
                Verify & notify doctor
              </Button>
            ) : null}
          </div>

          {(activeRequest.items ?? []).length ? (
            <form
              className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
              onSubmit={(e) => {
                e.preventDefault()
                enterResult.mutate(e.currentTarget)
              }}
            >
              <p className="text-sm font-bold text-slate-800">Enter structured result</p>
              <SelectField name="requestItemId" label="Test" required>
                {(activeRequest.items ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.test?.name ?? item.panel?.name ?? item.id}
                  </option>
                ))}
              </SelectField>
              <Field name="value" label="Value" required />
              <Field name="unit" label="Unit" />
              <Button type="submit" loading={enterResult.isPending}>Save result</Button>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
