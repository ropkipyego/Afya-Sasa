import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowLeft, Droplets, Stethoscope, Wind } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader, SelectField, TextareaField } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type IcuAdmission = {
  id: string
  reason: string
  severityScore: number | null
  status: 'active' | 'transferred_out' | 'discharged' | 'died'
  admittedToIcuAt: string
  admission: {
    id: string
    admissionNo: string
    patient: { id: string; firstName: string; lastName: string; patientNo: string }
    ward?: { name: string }
    bed?: { bedNo: string }
  }
  icuBed?: { bedNo: string } | null
}

type IcuWorkspace = IcuAdmission & {
  observations: Array<{
    id: string
    recordedAt: string
    heartRate: number | null
    bpSystolic: number | null
    bpDiastolic: number | null
    spo2: number | null
    gcs: number | null
    notes: string | null
  }>
  ventilatorRecords: Array<{ id: string; recordedAt: string; mode: string; fio2: number | null; peep: number | null }>
  fluidRecords: Array<{ id: string; recordedAt: string; inputVolumeMl: number | null; outputVolumeMl: number | null; netBalanceMl: number | null }>
  rounds: Array<{ id: string; roundTime: string; assessment: string; plan: string; escalationDecision: string | null }>
}

type IpdAdmission = {
  id: string
  admissionNo: string
  status: string
  patient: { firstName: string; lastName: string; patientNo: string }
  ward: { name: string }
  bed: { bedNo: string }
}

export function IcuModule() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdmit, setShowAdmit] = useState(false)

  const { data: admissions = [], isLoading } = useQuery({
    queryKey: ['icu-admissions', 'active'],
    queryFn: () => apiRequest<IcuAdmission[]>('/icu/admissions?status=active'),
    refetchInterval: 30_000,
  })

  if (selectedId) {
    return <IcuPatientWorkspace icuId={selectedId} onBack={() => setSelectedId(null)} />
  }

  if (showAdmit) {
    return (
      <IcuAdmitPanel
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
      <Card className="bg-gradient-to-br from-red-900 to-rose-950 p-8 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Intensive Care Unit"
            description="Critical care admissions, monitoring, ventilator charting, fluid balance, and consultant rounds."
          />
          <Button variant="secondary" onClick={() => setShowAdmit(true)}>
            Admit to ICU
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
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left transition hover:border-red-300 hover:bg-red-50/50"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-red-700">
                  <Activity className="h-4 w-4" />
                  ICU active
                </div>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {row.admission.patient.firstName} {row.admission.patient.lastName}
                </p>
                <p className="text-sm text-slate-600">{row.admission.patient.patientNo}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {row.admission.ward?.name ?? 'Ward'} · Bed {row.icuBed?.bedNo ?? row.admission.bed?.bedNo ?? '—'}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{row.reason}</p>
              </button>
            ))}
          </div>
        ) : (
          <Alert tone="info" title="No active ICU admissions">
            Use <strong>Admit to ICU</strong> for an inpatient already on a ward.
          </Alert>
        )}
      </Card>
    </div>
  )
}

function IcuAdmitPanel({
  onBack,
  onAdmitted,
}: {
  onBack: () => void
  onAdmitted: (icuAdmissionId: string) => void
}) {
  const queryClient = useQueryClient()
  const [admissionId, setAdmissionId] = useState('')
  const [reason, setReason] = useState('')
  const [severity, setSeverity] = useState('')

  const { data: ipdAdmissions = [] } = useQuery({
    queryKey: ['ipd-admissions', 'active'],
    queryFn: () => apiRequest<IpdAdmission[]>('/inpatient/admissions?status=active'),
  })

  const admit = useMutation({
    mutationFn: () =>
      apiRequest<IcuAdmission>('/icu/admissions', {
        method: 'POST',
        body: JSON.stringify({
          admissionId,
          reason: reason.trim(),
          severityScore: severity ? Number(severity) : undefined,
        }),
      }),
    onSuccess: (row) => {
      notify('ICU admission', 'Patient accepted into intensive care.', 'success')
      void queryClient.invalidateQueries({ queryKey: ['icu-admissions'] })
      onAdmitted(row.id)
    },
    onError: (e: Error) => notify('ICU admit failed', e.message, 'critical'),
  })

  return (
    <Card className="p-6">
      <Button variant="ghost" className="mb-4" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to ICU board
      </Button>
      <PageHeader title="Admit to ICU" description="Link an active IPD admission to the ICU service line." />
      <div className="mt-6 grid max-w-xl gap-4">
        <SelectField name="icu-admission" label="Active IPD admission" value={admissionId} onChange={(e) => setAdmissionId(e.target.value)}>
          <option value="">Select admission…</option>
          {ipdAdmissions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.patient.firstName} {a.patient.lastName} — {a.admissionNo} ({a.ward.name})
            </option>
          ))}
        </SelectField>
        <TextareaField name="icu-reason" label="Reason for ICU" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">Severity score (optional)</span>
          <input
            type="number"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            min={0}
            max={10}
          />
        </label>
        <Button
          disabled={!admissionId || !reason.trim() || admit.isPending}
          onClick={() => admit.mutate()}
        >
          Confirm ICU admission
        </Button>
      </div>
    </Card>
  )
}

function IcuPatientWorkspace({ icuId, onBack }: { icuId: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'monitor' | 'vent' | 'fluid' | 'rounds'>('monitor')

  const { data, isLoading } = useQuery({
    queryKey: ['icu-workspace', icuId],
    queryFn: () => apiRequest<IcuWorkspace>(`/icu/admissions/${icuId}`),
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['icu-workspace', icuId] })

  const [hr, setHr] = useState('')
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [spo2, setSpo2] = useState('')
  const [gcs, setGcs] = useState('')

  const observe = useMutation({
    mutationFn: () =>
      apiRequest(`/icu/admissions/${icuId}/observations`, {
        method: 'POST',
        body: JSON.stringify({
          heartRate: hr ? Number(hr) : undefined,
          bpSystolic: sys ? Number(sys) : undefined,
          bpDiastolic: dia ? Number(dia) : undefined,
          spo2: spo2 ? Number(spo2) : undefined,
          gcs: gcs ? Number(gcs) : undefined,
        }),
      }),
    onSuccess: () => {
      notify('Observation saved', '', 'success')
      setHr('')
      setSys('')
      setDia('')
      setSpo2('')
      setGcs('')
      invalidate()
    },
    onError: (e: Error) => notify('Save failed', e.message, 'critical'),
  })

  const [mode, setMode] = useState('SIMV')
  const [fio2, setFio2] = useState('')
  const [peep, setPeep] = useState('')

  const vent = useMutation({
    mutationFn: () =>
      apiRequest(`/icu/admissions/${icuId}/ventilator-records`, {
        method: 'POST',
        body: JSON.stringify({
          mode,
          fio2: fio2 ? Number(fio2) : undefined,
          peep: peep ? Number(peep) : undefined,
        }),
      }),
    onSuccess: () => {
      notify('Ventilator chart updated', '', 'success')
      invalidate()
    },
    onError: (e: Error) => notify('Save failed', e.message, 'critical'),
  })

  const [inputMl, setInputMl] = useState('')
  const [outputMl, setOutputMl] = useState('')

  const fluid = useMutation({
    mutationFn: () =>
      apiRequest(`/icu/admissions/${icuId}/fluid-balance`, {
        method: 'POST',
        body: JSON.stringify({
          inputVolumeMl: inputMl ? Number(inputMl) : undefined,
          outputVolumeMl: outputMl ? Number(outputMl) : undefined,
        }),
      }),
    onSuccess: () => {
      notify('Fluid balance recorded', '', 'success')
      setInputMl('')
      setOutputMl('')
      invalidate()
    },
    onError: (e: Error) => notify('Save failed', e.message, 'critical'),
  })

  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')

  const round = useMutation({
    mutationFn: () =>
      apiRequest(`/icu/admissions/${icuId}/rounds`, {
        method: 'POST',
        body: JSON.stringify({ assessment: assessment.trim(), plan: plan.trim() }),
      }),
    onSuccess: () => {
      notify('ICU round saved', '', 'success')
      setAssessment('')
      setPlan('')
      invalidate()
    },
    onError: (e: Error) => notify('Save failed', e.message, 'critical'),
  })

  const discharge = useMutation({
    mutationFn: () =>
      apiRequest(`/icu/admissions/${icuId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'transferred_out' }),
      }),
    onSuccess: () => {
      notify('ICU episode closed', 'Patient marked transferred out of ICU.', 'success')
      void queryClient.invalidateQueries({ queryKey: ['icu-admissions'] })
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
          ICU board
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="text-sm text-slate-600">
              {patient.patientNo} · {data.admission.admissionNo} · Admitted{' '}
              {new Date(data.admittedToIcuAt).toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-slate-700">{data.reason}</p>
          </div>
          <Button variant="secondary" onClick={() => discharge.mutate()} disabled={discharge.isPending}>
            Transfer out of ICU
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              ['monitor', 'Monitoring', Stethoscope],
              ['vent', 'Ventilator', Wind],
              ['fluid', 'Fluid balance', Droplets],
              ['rounds', 'Rounds', Activity],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                tab === id ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'
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
              <Field name="hr" label="HR" value={hr} onChange={(e) => setHr(e.target.value)} />
              <Field name="spo2" label="SpO₂" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
              <Field name="sys" label="BP sys" value={sys} onChange={(e) => setSys(e.target.value)} />
              <Field name="dia" label="BP dia" value={dia} onChange={(e) => setDia(e.target.value)} />
              <Field name="gcs" label="GCS" value={gcs} onChange={(e) => setGcs(e.target.value)} />
            </div>
            <Button className="mt-4" onClick={() => observe.mutate()} disabled={observe.isPending}>Save vitals</Button>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold text-slate-900">Recent observations</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {data.observations.map((o) => (
                <li key={o.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <time className="text-xs text-slate-500">{new Date(o.recordedAt).toLocaleString()}</time>
                  <p className="mt-1">
                    HR {o.heartRate ?? '—'} · BP {o.bpSystolic ?? '—'}/{o.bpDiastolic ?? '—'} · SpO₂ {o.spo2 ?? '—'}% · GCS {o.gcs ?? '—'}
                  </p>
                </li>
              ))}
              {!data.observations.length ? <p className="text-slate-500">No observations yet.</p> : null}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === 'vent' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-bold">Ventilator settings</h3>
            <div className="mt-4 grid gap-3">
              <SelectField name="vent-mode" label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option>SIMV</option>
                <option>AC</option>
                <option>CPAP</option>
                <option>PSV</option>
              </SelectField>
              <Field name="fio2" label="FiO₂ %" value={fio2} onChange={(e) => setFio2(e.target.value)} />
              <Field name="peep" label="PEEP" value={peep} onChange={(e) => setPeep(e.target.value)} />
            </div>
            <Button className="mt-4" onClick={() => vent.mutate()} disabled={vent.isPending}>Record settings</Button>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold">Ventilator log</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {data.ventilatorRecords.map((v) => (
                <li key={v.id} className="rounded-xl border p-3">
                  {new Date(v.recordedAt).toLocaleString()} — {v.mode} · FiO₂ {v.fio2 ?? '—'} · PEEP {v.peep ?? '—'}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === 'fluid' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-bold">Fluid balance entry</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field name="input-ml" label="Input (ml)" value={inputMl} onChange={(e) => setInputMl(e.target.value)} />
              <Field name="output-ml" label="Output (ml)" value={outputMl} onChange={(e) => setOutputMl(e.target.value)} />
            </div>
            <Button className="mt-4" onClick={() => fluid.mutate()} disabled={fluid.isPending}>Save balance</Button>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold">Fluid log</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {data.fluidRecords.map((f) => (
                <li key={f.id} className="rounded-xl border p-3">
                  {new Date(f.recordedAt).toLocaleString()} — In {f.inputVolumeMl ?? 0} / Out {f.outputVolumeMl ?? 0} · Net {f.netBalanceMl ?? 0} ml
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === 'rounds' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-bold">Consultant round</h3>
            <div className="mt-4 space-y-3">
              <TextareaField name="assessment" label="Assessment" rows={4} value={assessment} onChange={(e) => setAssessment(e.target.value)} />
              <TextareaField name="plan" label="Plan" rows={4} value={plan} onChange={(e) => setPlan(e.target.value)} />
            </div>
            <Button className="mt-4" onClick={() => round.mutate()} disabled={!assessment.trim() || !plan.trim() || round.isPending}>Save round</Button>
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
