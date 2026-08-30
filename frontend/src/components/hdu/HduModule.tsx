import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowLeft, HeartPulse, Stethoscope } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader, SelectField, TextareaField } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type HduAdmission = {
  id: string
  reason: string
  status: 'active' | 'transferred_out' | 'discharged' | 'died'
  admittedToHduAt: string
  admission: {
    id: string
    admissionNo: string
    patient: { id: string; firstName: string; lastName: string; patientNo: string }
    ward?: { name: string }
    bed?: { bedNo: string }
  }
  hduBed?: { bedNo: string } | null
}

type HduWorkspace = HduAdmission & {
  observations: Array<{
    id: string
    recordedAt: string
    heartRate: number | null
    bpSystolic: number | null
    bpDiastolic: number | null
    spo2: number | null
    oxygenSupport: string | null
    escalationRequired: boolean
    notes: string | null
  }>
  rounds: Array<{ id: string; roundTime: string; assessment: string; plan: string; escalationDecision: string | null }>
}

type IpdAdmission = {
  id: string
  admissionNo: string
  patient: { firstName: string; lastName: string; patientNo: string }
  ward: { name: string }
}

export function HduModule() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdmit, setShowAdmit] = useState(false)

  const { data: admissions = [], isLoading } = useQuery({
    queryKey: ['hdu-admissions', 'active'],
    queryFn: () => apiRequest<HduAdmission[]>('/hdu/admissions?status=active'),
    refetchInterval: 30_000,
  })

  if (selectedId) {
    return <HduPatientWorkspace hduId={selectedId} onBack={() => setSelectedId(null)} />
  }

  if (showAdmit) {
    return (
      <HduAdmitPanel
        onBack={() => setShowAdmit(false)}
        onAdmitted={(id) => {
          setShowAdmit(false)
          setSelectedId(id)
        }}
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-orange-900 to-amber-950 p-8 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="High Dependency Unit"
            description="Step-down critical care — close monitoring, oxygen support, and consultant review."
          />
          <Button variant="secondary" onClick={() => setShowAdmit(true)}>
            Admit to HDU
          </Button>
        </div>
        <p className="mt-4 text-sm text-white/80">
          Active patients: <strong>{admissions.length}</strong>
        </p>
      </Card>

      <Card className="p-6">
        {isLoading ? (
          <div className="h-48 animate-skeleton rounded-xl" />
        ) : admissions.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {admissions.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left transition hover:border-orange-300 hover:bg-orange-50/50"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-orange-800">
                  <HeartPulse className="h-4 w-4" />
                  HDU active
                </div>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {row.admission.patient.firstName} {row.admission.patient.lastName}
                </p>
                <p className="text-sm text-slate-600">{row.admission.patient.patientNo}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {row.admission.ward?.name ?? 'Ward'} · Bed {row.hduBed?.bedNo ?? row.admission.bed?.bedNo ?? '—'}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{row.reason}</p>
              </button>
            ))}
          </div>
        ) : (
          <Alert tone="info" title="No active HDU admissions">
            Admit an inpatient who needs enhanced monitoring but not full ICU support.
          </Alert>
        )}
      </Card>
    </div>
  )
}

function HduAdmitPanel({
  onBack,
  onAdmitted,
}: {
  onBack: () => void
  onAdmitted: (hduAdmissionId: string) => void
}) {
  const queryClient = useQueryClient()
  const [admissionId, setAdmissionId] = useState('')
  const [reason, setReason] = useState('')

  const { data: ipdAdmissions = [] } = useQuery({
    queryKey: ['ipd-admissions', 'active'],
    queryFn: () => apiRequest<IpdAdmission[]>('/inpatient/admissions?status=active'),
  })

  const admit = useMutation({
    mutationFn: () =>
      apiRequest<HduAdmission>('/hdu/admissions', {
        method: 'POST',
        body: JSON.stringify({ admissionId, reason: reason.trim() }),
      }),
    onSuccess: (row) => {
      notify('HDU admission', 'Patient accepted into high dependency care.', 'success')
      void queryClient.invalidateQueries({ queryKey: ['hdu-admissions'] })
      onAdmitted(row.id)
    },
    onError: (e: Error) => notify('HDU admit failed', e.message, 'critical'),
  })

  return (
    <Card className="p-6">
      <Button variant="ghost" className="mb-4" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to HDU board
      </Button>
      <PageHeader title="Admit to HDU" description="Link an active IPD admission to the HDU service line." />
      <div className="mt-6 grid max-w-xl gap-4">
        <SelectField name="hdu-admission" label="Active IPD admission" value={admissionId} onChange={(e) => setAdmissionId(e.target.value)}>
          <option value="">Select admission…</option>
          {ipdAdmissions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.patient.firstName} {a.patient.lastName} — {a.admissionNo} ({a.ward.name})
            </option>
          ))}
        </SelectField>
        <TextareaField name="hdu-reason" label="Reason for HDU" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        <Button disabled={!admissionId || !reason.trim() || admit.isPending} onClick={() => admit.mutate()}>
          Confirm HDU admission
        </Button>
      </div>
    </Card>
  )
}

function HduPatientWorkspace({ hduId, onBack }: { hduId: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'monitor' | 'rounds'>('monitor')

  const { data, isLoading } = useQuery({
    queryKey: ['hdu-workspace', hduId],
    queryFn: () => apiRequest<HduWorkspace>(`/hdu/admissions/${hduId}`),
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['hdu-workspace', hduId] })

  const [hr, setHr] = useState('')
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [spo2, setSpo2] = useState('')
  const [oxygen, setOxygen] = useState('')

  const observe = useMutation({
    mutationFn: () =>
      apiRequest(`/hdu/admissions/${hduId}/observations`, {
        method: 'POST',
        body: JSON.stringify({
          heartRate: hr ? Number(hr) : undefined,
          bpSystolic: sys ? Number(sys) : undefined,
          bpDiastolic: dia ? Number(dia) : undefined,
          spo2: spo2 ? Number(spo2) : undefined,
          oxygenSupport: oxygen.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      notify('Observation saved', '', 'success')
      setHr('')
      setSys('')
      setDia('')
      setSpo2('')
      setOxygen('')
      invalidate()
    },
    onError: (e: Error) => notify('Save failed', e.message, 'critical'),
  })

  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')

  const round = useMutation({
    mutationFn: () =>
      apiRequest(`/hdu/admissions/${hduId}/rounds`, {
        method: 'POST',
        body: JSON.stringify({ assessment: assessment.trim(), plan: plan.trim() }),
      }),
    onSuccess: () => {
      notify('HDU round saved', '', 'success')
      setAssessment('')
      setPlan('')
      invalidate()
    },
    onError: (e: Error) => notify('Save failed', e.message, 'critical'),
  })

  const discharge = useMutation({
    mutationFn: () =>
      apiRequest(`/hdu/admissions/${hduId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'transferred_out' }),
      }),
    onSuccess: () => {
      notify('HDU episode closed', 'Patient marked transferred out of HDU.', 'success')
      void queryClient.invalidateQueries({ queryKey: ['hdu-admissions'] })
      onBack()
    },
    onError: (e: Error) => notify('Update failed', e.message, 'critical'),
  })

  if (isLoading || !data) {
    return <div className="h-64 animate-skeleton rounded-2xl" />
  }

  const patient = data.admission.patient

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="p-6">
        <Button variant="ghost" className="mb-4" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          HDU board
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="text-sm text-slate-600">
              {patient.patientNo} · {data.admission.admissionNo} · Admitted{' '}
              {new Date(data.admittedToHduAt).toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-slate-700">{data.reason}</p>
          </div>
          <Button variant="secondary" onClick={() => discharge.mutate()} disabled={discharge.isPending}>
            Transfer out of HDU
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              ['monitor', 'Monitoring', Stethoscope],
              ['rounds', 'Rounds', Activity],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                tab === id ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'monitor' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-bold text-slate-900">Record observation</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field name="hdu-hr" label="HR" value={hr} onChange={(e) => setHr(e.target.value)} />
              <Field name="hdu-spo2" label="SpO₂" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
              <Field name="hdu-sys" label="BP sys" value={sys} onChange={(e) => setSys(e.target.value)} />
              <Field name="hdu-dia" label="BP dia" value={dia} onChange={(e) => setDia(e.target.value)} />
              <Field name="hdu-o2" label="Oxygen support" value={oxygen} onChange={(e) => setOxygen(e.target.value)} className="col-span-2" />
            </div>
            <Button className="mt-4" onClick={() => observe.mutate()} disabled={observe.isPending}>
              Save observation
            </Button>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold text-slate-900">Recent observations</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {data.observations.map((o) => (
                <li key={o.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <time className="text-xs text-slate-500">{new Date(o.recordedAt).toLocaleString()}</time>
                  <p className="mt-1">
                    HR {o.heartRate ?? '—'} · BP {o.bpSystolic ?? '—'}/{o.bpDiastolic ?? '—'} · SpO₂ {o.spo2 ?? '—'}%
                    {o.oxygenSupport ? ` · ${o.oxygenSupport}` : ''}
                  </p>
                </li>
              ))}
              {!data.observations.length ? <p className="text-slate-500">No observations yet.</p> : null}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === 'rounds' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-bold">Consultant round</h3>
            <div className="mt-4 space-y-3">
              <TextareaField name="hdu-assessment" label="Assessment" rows={4} value={assessment} onChange={(e) => setAssessment(e.target.value)} />
              <TextareaField name="hdu-plan" label="Plan" rows={4} value={plan} onChange={(e) => setPlan(e.target.value)} />
            </div>
            <Button className="mt-4" onClick={() => round.mutate()} disabled={!assessment.trim() || !plan.trim() || round.isPending}>
              Save round
            </Button>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold">Round history</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {data.rounds.map((r) => (
                <li key={r.id} className="rounded-xl border p-3">
                  <time className="text-xs text-slate-500">{new Date(r.roundTime).toLocaleString()}</time>
                  <p className="mt-1 font-medium">{r.assessment}</p>
                  <p className="text-slate-600">{r.plan}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
