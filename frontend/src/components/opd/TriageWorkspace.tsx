import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Clock,
  HeartPulse,
  X,
} from 'lucide-react'
import {
  Button,
  Card,
  ClinicalForm,
  FormActions,
  FormSection,
  PageHeader,
  SelectField,
  TextareaField,
} from '../ui'
import { WorkflowBadge } from '../WorkflowBadge'
import { PatientContextHeader } from '../PatientContextHeader'
import { PatientTimeline, type TimelineEvent } from '../PatientTimeline'
import { VitalsForm } from '../VitalsFields'
import { apiRequest } from '../../lib/api'
import { formDataFromElement } from '../../lib/form-utils'
import { mapEncounterStatusToWorkflow } from '../../lib/workflow-status'
import { notify } from '../../lib/notify'

type TriagePatient = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  primaryPhone: string
  allergies?: { allergen: string; severity: string }[]
  chronicConditions?: { name: string; status: string }[]
}

type EncounterItem = {
  id: string
  encounterNo: string
  patient: TriagePatient
}

const severityTone: Record<string, string> = {
  mild: 'bg-emerald-50 text-emerald-800',
  moderate: 'bg-amber-50 text-amber-900',
  severe: 'bg-orange-50 text-orange-900',
  life_threatening: 'bg-red-50 text-red-900',
}

export function TriageWorkspace() {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)

  const { data: encounters = [], isLoading } = useQuery({
    queryKey: ['triage-queue'],
    queryFn: () => apiRequest<EncounterItem[]>('/opd/triage/queue'),
  })

  const { data: board } = useQuery({
    queryKey: ['triage-board'],
    queryFn: () =>
      apiRequest<{
        counts: {
          waitingTriage: number
          waitingDoctor: number
          inConsultation: number
          completed: number
          totalToday: number
        }
        patients: {
          id: string
          encounterNo: string
          status: string
          patientName: string
          triageColour: string | null
        }[]
      }>('/opd/triage/board'),
    refetchInterval: 20_000,
  })

  const activeEncounter = encounters.find((e) => e.id === activeId) ?? null

  useEffect(() => {
    if (!activeId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [activeId])

  const { data: timeline } = useQuery({
    queryKey: ['triage-timeline', activeEncounter?.patient.id],
    queryFn: () =>
      apiRequest<{ events: TimelineEvent[] }>(
        `/patients/${activeEncounter!.patient.id}/timeline`,
      ),
    enabled: Boolean(activeEncounter?.patient.id),
  })

  const triage = useMutation({
    mutationFn: ({
      formElement,
      encounterId,
    }: {
      formElement: HTMLFormElement
      encounterId: string
    }) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/opd/encounters/${encounterId}/triage`, {
        method: 'POST',
        body: JSON.stringify({
          category: form.get('category'),
          colour: form.get('colour'),
          chiefComplaint: form.get('chiefComplaint'),
          painScore: Number(form.get('painScore') || 0),
          temperature: Number(form.get('temperature') || 0),
          pulse: Number(form.get('pulse') || 0),
          respiratoryRate: Number(form.get('respiratoryRate') || 0),
          bpSystolic: Number(form.get('bpSystolic') || 0),
          bpDiastolic: Number(form.get('bpDiastolic') || 0),
          spo2: Number(form.get('spo2') || 0),
          weight: Number(form.get('weight') || 0),
          height: Number(form.get('height') || 0),
        }),
      })
    },
    onSuccess: async (_data, variables) => {
      const patient = encounters.find((e) => e.id === variables.encounterId)?.patient
      const name = patient
        ? `${patient.firstName} ${patient.lastName}`
        : 'Patient'
      notify('Triage submitted', `${name} moved to doctor queue.`, 'success')
      setActiveId(null)
      await queryClient.invalidateQueries({ queryKey: ['triage-queue'] })
      await queryClient.invalidateQueries({ queryKey: ['triage-board'] })
      await queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
    },
    onError: (error: Error) => notify('Triage failed', error.message, 'critical'),
  })

  const previousVisits = (timeline?.events ?? []).filter((e) => e.type === 'visit').slice(0, 5)
  const alerts = [
    ...(activeEncounter?.patient.allergies ?? []).map((a) => ({
      label: `Allergy: ${a.allergen}`,
      tone: severityTone[a.severity] ?? 'bg-red-50 text-red-900',
    })),
    ...(activeEncounter?.patient.chronicConditions ?? []).map((c) => ({
      label: `Condition: ${c.name}`,
      tone: 'bg-amber-50 text-amber-900',
    })),
  ]

  const modal =
    activeEncounter && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4">
            <button
              type="button"
              aria-label="Close triage"
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setActiveId(null)}
            />
            <div className="relative z-10 flex max-h-[95dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
                    Triage assessment
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {activeEncounter.patient.firstName} {activeEncounter.patient.lastName} ·{' '}
                    {activeEncounter.encounterNo}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200"
                  onClick={() => setActiveId(null)}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 overflow-y-auto p-4 sm:p-6">
                <PatientContextHeader patient={activeEncounter.patient} workflowStep="in_triage" />

                {alerts.length ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-red-900">
                      <AlertTriangle className="h-4 w-4" />
                      Clinical alerts
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {alerts.map((alert) => (
                        <span
                          key={alert.label}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${alert.tone}`}
                        >
                          {alert.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card padding="sm">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                      <Clock className="h-4 w-4" />
                      Previous visits
                    </div>
                    <ul className="mt-3 space-y-2 text-sm">
                      {previousVisits.map((visit) => (
                        <li key={visit.id} className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="font-medium">{visit.title}</p>
                          <p className="text-xs text-slate-500">{visit.summary}</p>
                        </li>
                      ))}
                      {!previousVisits.length ? (
                        <li className="text-slate-500">No prior visits on record.</li>
                      ) : null}
                    </ul>
                  </Card>
                  <PatientTimeline
                    events={(timeline?.events ?? []).slice(0, 4)}
                    title="Recent timeline"
                    description="Last clinical events"
                  />
                </div>

                <Card className="border-l-4 border-l-teal-500 p-4 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <HeartPulse className="h-5 w-5 text-teal-600" />
                    <PageHeader
                      title="Vitals & category"
                      description="Abnormal values generate alerts for the doctor."
                    />
                  </div>
                  <ClinicalForm
                    onSubmit={(event) => {
                      event.preventDefault()
                      triage.mutate({
                        formElement: event.currentTarget,
                        encounterId: activeEncounter.id,
                      })
                    }}
                  >
                    <FormSection title="Triage category" columns={3}>
                      <SelectField name="colour" label="Triage colour" required>
                        <option value="red">Emergency — Red</option>
                        <option value="orange">Urgent — Orange</option>
                        <option value="yellow">Priority — Yellow</option>
                        <option value="green">Routine — Green</option>
                        <option value="blue">Non-urgent — Blue</option>
                      </SelectField>
                      <SelectField name="category" label="Category" required>
                        <option value="general">General</option>
                        <option value="paediatric">Paediatric</option>
                        <option value="obstetric">Obstetric</option>
                        <option value="trauma">Trauma</option>
                        <option value="mental_health">Mental health</option>
                      </SelectField>
                      <SelectField name="painScore" label="Pain score" required>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                          <option key={score} value={score}>
                            {score}
                          </option>
                        ))}
                      </SelectField>
                    </FormSection>

                    <TextareaField
                      name="chiefComplaint"
                      label="Triage notes / chief complaint"
                      placeholder="Patient's main concern"
                      required
                    />

                    <FormSection title="Vitals" description="Normal ranges shown below each field." columns={1}>
                      <VitalsForm />
                    </FormSection>

                    <FormActions>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setActiveId(null)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" loading={triage.isPending} className="min-h-12">
                        Submit triage → doctor queue
                      </Button>
                    </FormActions>
                  </ClinicalForm>
                </Card>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="workspace-shell animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Awaiting triage', value: board?.counts.waitingTriage ?? 0, tone: 'border-amber-200 bg-amber-50' },
          { label: 'Doctor queue', value: board?.counts.waitingDoctor ?? 0, tone: 'border-sky-200 bg-sky-50' },
          { label: 'In consultation', value: board?.counts.inConsultation ?? 0, tone: 'border-teal-200 bg-teal-50' },
          { label: 'Completed today', value: board?.counts.completed ?? 0, tone: 'border-emerald-200 bg-emerald-50' },
        ].map((item) => (
          <div
            key={item.label}
            className={`card-hover rounded-2xl border p-5 ${item.tone} queue-item-enter`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{item.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(280px,1fr)]">
        <Card className="p-5 md:p-6">
          <PageHeader title="Triage queue" description="Tap a patient to open triage in a popup." />
          {isLoading ? (
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-skeleton rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {encounters.map((encounter) => (
                <button
                  key={encounter.id}
                  type="button"
                  onClick={() => setActiveId(encounter.id)}
                  className="card-hover w-full rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-teal-200"
                >
                  <p className="font-semibold">
                    {encounter.patient.firstName} {encounter.patient.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{encounter.encounterNo}</p>
                </button>
              ))}
              {!encounters.length ? (
                <p className="py-12 text-center text-sm text-slate-500">No patients waiting.</p>
              ) : null}
            </div>
          )}
        </Card>

        <Card padding="sm">
          <p className="text-xs font-bold uppercase text-slate-500">Today&apos;s flow</p>
          <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
            {(board?.patients ?? []).map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <span className="font-medium">{patient.patientName}</span>
                <WorkflowBadge
                  step={mapEncounterStatusToWorkflow(patient.status)}
                  className="shrink-0"
                />
              </div>
            ))}
            {!(board?.patients ?? []).length ? (
              <p className="py-8 text-center text-sm text-slate-500">No flow activity yet today.</p>
            ) : null}
          </div>
        </Card>
      </div>

      {modal}
    </div>
  )
}
