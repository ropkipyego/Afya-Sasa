import { useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Button, Card, Field, PageHeader, SelectField, TextareaField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type PregnancyRow = {
  id: string
  pregnancyNo: string
  gravida: number
  para: number
  lmpDate: string | null
  edd: string | null
  riskLevel: string
  status: string
  patient: { firstName: string; lastName: string; patientNo: string }
}

type PregnancyDetail = PregnancyRow & {
  ancVisits?: {
    id: string
    visitDate: string
    gestationalAgeWeeks: number | null
    weightKg: string | null
    bpSystolic: number | null
    bpDiastolic: number | null
    fetalHeartRate: number | null
    fundalHeightCm: string | null
    plan: string
  }[]
}

export function AncClinicWorkspace() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)

  const { data: pregnancies = [] } = useQuery({
    queryKey: ['pregnancies'],
    queryFn: () => apiRequest<PregnancyRow[]>('/maternity/pregnancies'),
  })

  const { data: detail } = useQuery({
    queryKey: ['pregnancy-detail', selectedId],
    queryFn: () => apiRequest<PregnancyDetail>(`/maternity/pregnancies/${selectedId}`),
    enabled: Boolean(selectedId),
  })

  const createPregnancy = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/maternity/pregnancies', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          gravida: Number(form.get('gravida') || 1),
          para: Number(form.get('para') || 0),
          lmpDate: form.get('lmpDate') || undefined,
          riskLevel: form.get('riskLevel'),
          riskNotes: form.get('riskNotes') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Pregnancy registered', 'ANC journey started.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['pregnancies'] })
    },
  })

  const createAnc = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/maternity/pregnancies/${selectedId}/anc-visits`, {
        method: 'POST',
        body: JSON.stringify({
          visitDate: form.get('visitDate'),
          gestationalAgeWeeks: Number(form.get('gestationalAgeWeeks') || 0) || undefined,
          weightKg: form.get('weightKg') ? Number(form.get('weightKg')) : undefined,
          bpSystolic: form.get('bpSystolic') ? Number(form.get('bpSystolic')) : undefined,
          bpDiastolic: form.get('bpDiastolic') ? Number(form.get('bpDiastolic')) : undefined,
          fetalHeartRate: form.get('fetalHeartRate') ? Number(form.get('fetalHeartRate')) : undefined,
          fundalHeightCm: form.get('fundalHeightCm') ? Number(form.get('fundalHeightCm')) : undefined,
          ultrasoundSummary: form.get('ultrasoundSummary') || undefined,
          riskAssessment: form.get('riskAssessment') || undefined,
          plan: form.get('plan'),
        }),
      })
    },
    onSuccess: async () => {
      notify('ANC visit saved', '', 'success')
      await queryClient.invalidateQueries({ queryKey: ['pregnancy-detail', selectedId] })
    },
  })

  const active = pregnancies.filter((p) => p.status === 'active')

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <Card>
          <PageHeader title="Register pregnancy" description="Gravida, para, LMP, EDD, risk factors." />
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); createPregnancy.mutate(e.currentTarget) }}>
            <PatientSearchAutocomplete selected={selectedPatient} onSelect={setSelectedPatient} />
            <Field name="gravida" label="Gravida (G)" type="number" min={1} defaultValue={1} required />
            <Field name="para" label="Para (P)" type="number" min={0} defaultValue={0} required />
            <Field name="lmpDate" label="LMP" type="date" />
            <SelectField name="riskLevel" label="Risk level" required defaultValue="low">
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </SelectField>
            <TextareaField name="riskNotes" label="Risk factors / history" />
            <Button type="submit" loading={createPregnancy.isPending} disabled={!selectedPatient}>
              Register pregnancy
            </Button>
          </form>
        </Card>
        <Card>
          <PageHeader title="ANC patients" />
          <div className="mt-3 space-y-2">
            {active.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={clsx(
                  'card-hover w-full rounded-xl border px-4 py-3 text-left',
                  selectedId === p.id ? 'border-pink-400 bg-pink-50' : 'border-slate-200',
                )}
              >
                <p className="font-semibold">{p.patient.firstName} {p.patient.lastName}</p>
                <p className="text-xs text-slate-500">G{p.gravida}P{p.para} · EDD {p.edd ?? '—'} · {p.riskLevel}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {selectedId && detail ? (
        <Card>
          <PageHeader title="ANC visit & pregnancy timeline" />
          <div className="mt-4 space-y-2">
            {(detail.ancVisits ?? []).map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-semibold">{v.visitDate} · {v.gestationalAgeWeeks ?? '?'} weeks</p>
                <p className="text-slate-600">
                  Wt {v.weightKg ?? '—'}kg · BP {v.bpSystolic ?? '—'}/{v.bpDiastolic ?? '—'} · FHR {v.fetalHeartRate ?? '—'} · FH {v.fundalHeightCm ?? '—'}cm
                </p>
                <p>{v.plan}</p>
              </div>
            ))}
          </div>
          <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); createAnc.mutate(e.currentTarget) }}>
            <Field name="visitDate" label="Visit date" type="date" required />
            <Field name="gestationalAgeWeeks" label="Gestational age (weeks)" type="number" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="weightKg" label="Weight (kg)" type="number" step="0.1" />
              <Field name="fundalHeightCm" label="Fundal height (cm)" type="number" step="0.1" />
              <Field name="bpSystolic" label="BP systolic" type="number" />
              <Field name="bpDiastolic" label="BP diastolic" type="number" />
              <Field name="fetalHeartRate" label="Fetal heart rate" type="number" />
            </div>
            <TextareaField name="ultrasoundSummary" label="Ultrasound summary" />
            <TextareaField name="riskAssessment" label="Risk assessment" />
            <TextareaField name="plan" label="Plan" required />
            <Button type="submit" loading={createAnc.isPending}>Record ANC visit</Button>
          </form>
        </Card>
      ) : (
        <Card><p className="py-20 text-center text-slate-500">Select a pregnancy for ANC care.</p></Card>
      )}
    </div>
  )
}
