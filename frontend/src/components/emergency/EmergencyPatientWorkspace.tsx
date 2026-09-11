import { useEffect, useMemo, useRef, useState } from 'react'
import { formDataFromElement } from '../../lib/form-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button, Card, Field, FormSection, PageHeader, SelectField, TextareaField } from '../ui'
import { VitalsForm } from '../VitalsFields'
import { ClinicalInvestigationOrders } from '../investigations/ClinicalInvestigationOrders'
import { PatientTimeline, type TimelineEvent } from '../PatientTimeline'
import { WorkspaceTabs } from '../ui/WorkspaceTabs'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { playNotificationSound } from '../../lib/notification-sound'

type Workspace = {
  id: string
  triageCategory: string | null
  workflowStage: string
  status?: string
  outcome?: string | null
  chiefComplaint: string | null
  observationStartedAt: string | null
  encounter: {
    id: string
    encounterNo: string
    patient: {
      id: string
      firstName: string
      lastName: string
      patientNo: string
      dateOfBirth: string
      gender: string
    }
  }
  allergies: { allergen: string; severity: string }[]
  chronicConditions: { name: string; status: string }[]
  notes: { id: string; noteType: string; body: string; createdAt: string }[]
  observationLogs: { id: string; vitalsSummary: string | null; nursingNotes: string | null; doctorReview: string | null; recordedAt: string }[]
}

type Bay = { id: string; name: string }

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'notes', label: 'Notes' },
  { id: 'orders', label: 'Orders' },
  { id: 'laboratory', label: 'Laboratory' },
  { id: 'radiology', label: 'Radiology' },
  { id: 'medication', label: 'Medication' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'observation', label: 'Observation' },
  { id: 'disposition', label: 'Disposition' },
] as const

type TabId = (typeof tabs)[number]['id']

const VITALS_INTERVAL_MS = 3 * 60 * 1000

function vitalsAreCritical(form: FormData) {
  const systolic = Number(form.get('bpSystolic') || 0)
  const diastolic = Number(form.get('bpDiastolic') || 0)
  const pulse = Number(form.get('pulse') || 0)
  const spo2 = Number(form.get('spo2') || 0)
  return (
    (systolic > 0 && systolic < 90) ||
    systolic > 180 ||
    diastolic > 110 ||
    (pulse > 0 && (pulse < 50 || pulse > 120)) ||
    (spo2 > 0 && spo2 < 92)
  )
}

function formatVitalsSummary(form: FormData) {
  const parts = [
    `BP ${form.get('bpSystolic')}/${form.get('bpDiastolic')}`,
    `HR ${form.get('pulse')}`,
    `RR ${form.get('respiratoryRate')}`,
    `SpO2 ${form.get('spo2')}%`,
    `Temp ${form.get('temperature')}°C`,
  ]
  return parts.join(' · ')
}

const outcomes = [
  ['discharged_home', 'Discharge home'],
  ['admitted_ipd', 'Admit to ward (IPD)'],
  ['transferred_icu', 'Transferred to ICU'],
  ['transferred_hdu', 'Transferred to HDU'],
  ['transferred_theatre', 'Transferred to theatre'],
  ['transferred_maternity', 'Transferred to maternity'],
  ['external_referral', 'External referral'],
  ['deceased', 'Deceased'],
  ['left_without_being_seen', 'Left without being seen'],
] as const

export function EmergencyPatientWorkspace({
  emergencyId,
  onBack,
  focusTriage = false,
}: {
  emergencyId: string
  onBack: () => void
  focusTriage?: boolean
}) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabId>(focusTriage ? 'overview' : 'overview')
  const [vitalsDue, setVitalsDue] = useState(false)
  const [outcome, setOutcome] = useState('')
  const alertedDueRef = useRef(false)

  const { data: workspace, isLoading } = useQuery({
    queryKey: ['emergency-workspace', emergencyId],
    queryFn: () => apiRequest<Workspace>(`/emergency/${emergencyId}/workspace`),
  })

  const { data: bays = [] } = useQuery({
    queryKey: ['emergency-bays-list'],
    queryFn: () => apiRequest<Bay[]>('/emergency/bays'),
  })

  const { data: availableBeds = [] } = useQuery({
    queryKey: ['available-beds'],
    queryFn: () =>
      apiRequest<{ id: string; bedNo: string; status?: string; ward: { name: string } }[]>(
        '/inpatient/beds/available',
      ),
    enabled: outcome === 'admitted_ipd',
  })

  const patientId = workspace?.encounter.patient.id
  const { data: timeline } = useQuery({
    queryKey: ['ed-timeline', patientId],
    queryFn: () => apiRequest<{ events: TimelineEvent[] }>(`/patients/${patientId}/timeline`),
    enabled: Boolean(patientId),
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['emergency-workspace', emergencyId] })
    await queryClient.invalidateQueries({ queryKey: ['emergency-queue'] })
    await queryClient.invalidateQueries({ queryKey: ['emergency-metrics'] })
  }

  const triage = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/emergency/${emergencyId}/triage`, {
        method: 'POST',
        body: JSON.stringify({
          triageCategory: form.get('triageCategory'),
          notes: form.get('notes') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Triage recorded', '', 'success')
      await refresh()
    },
  })

  const assignBay = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/emergency/${emergencyId}/assign-bay`, {
        method: 'POST',
        body: JSON.stringify({ bayId: form.get('bayId') }),
      })
    },
    onSuccess: async () => {
      notify('Bay assigned', '', 'success')
      await refresh()
    },
  })

  const addMedication = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/emergency/${emergencyId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          noteType: 'clinical',
          body: `Medication: ${form.get('medication')} ${form.get('dose')} ${form.get('route')}${form.get('notes') ? ` — ${form.get('notes')}` : ''}`,
        }),
      })
    },
    onSuccess: async () => {
      notify('Medication recorded', '', 'success')
      await refresh()
    },
  })

  const addNote = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/emergency/${emergencyId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          noteType: form.get('noteType'),
          body: form.get('body'),
        }),
      })
    },
    onSuccess: async () => {
      notify('Note saved', '', 'success')
      await refresh()
    },
  })

  const addObservation = useMutation({
    mutationFn: async (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const vitalsSummary = formatVitalsSummary(form)
      const nursingNotes = form.get('nursingNotes')?.toString()
      const doctorReview = form.get('doctorReview')?.toString()
      await apiRequest(`/emergency/${emergencyId}/observation`, {
        method: 'POST',
        body: JSON.stringify({
          vitalsSummary,
          nursingNotes: nursingNotes || undefined,
          doctorReview: doctorReview || undefined,
        }),
      })
      if (vitalsAreCritical(form)) {
        await apiRequest('/emergency/alerts', {
          method: 'POST',
          body: JSON.stringify({
            encounterId: workspace?.encounter.id,
            type: 'critical_vitals',
            severity: 'critical',
            message: `Critical vitals — ${vitalsSummary}`,
          }),
        })
      }
    },
    onSuccess: async () => {
      setVitalsDue(false)
      alertedDueRef.current = false
      notify('Observation logged', 'Vitals recorded.', 'success')
      await refresh()
      await queryClient.invalidateQueries({ queryKey: ['emergency-alerts'] })
    },
  })

  const lastVitalsAt = useMemo(() => {
    const times = (workspace?.observationLogs ?? [])
      .map((log) => new Date(log.recordedAt).getTime())
      .filter((value) => Number.isFinite(value))
    return times.length ? Math.max(...times) : null
  }, [workspace?.observationLogs])

  useEffect(() => {
    if (!workspace || workspace.status === 'disposed') return
    if (focusTriage && !workspace.triageCategory) {
      setTab('overview')
    }
  }, [focusTriage, workspace])

  useEffect(() => {
    if (!workspace || workspace.status === 'disposed') return
    const tick = () => {
      const due = !lastVitalsAt || Date.now() - lastVitalsAt >= VITALS_INTERVAL_MS
      setVitalsDue(due)
      if (due && !alertedDueRef.current) {
        alertedDueRef.current = true
        playNotificationSound('critical')
        notify('Vitals due', 'Record ED vitals — 3-minute monitoring interval.', 'critical')
      }
    }
    tick()
    const interval = window.setInterval(tick, 30_000)
    return () => window.clearInterval(interval)
  }, [lastVitalsAt, workspace])

  const disposition = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/emergency/${emergencyId}/disposition`, {
        method: 'POST',
        body: JSON.stringify({
          outcome: form.get('outcome'),
          transferFacility: form.get('transferFacility') || undefined,
          notes: form.get('notes') || undefined,
          bedId: form.get('bedId') || undefined,
          admissionReason: form.get('admissionReason') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Disposition recorded', outcome === 'admitted_ipd' ? 'IPD admission created.' : 'Emergency episode closed.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['emergency-queue'] })
      await queryClient.invalidateQueries({ queryKey: ['emergency-metrics'] })
      await queryClient.invalidateQueries({ queryKey: ['emergency-bays'] })
      await queryClient.invalidateQueries({ queryKey: ['ipd-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['available-beds'] })
      onBack()
    },
  })

  const isClosed = workspace?.status === 'disposed' || workspace?.workflowStage === 'disposed'

  if (isLoading || !workspace) {
    return <Card className="p-8 text-center text-slate-500">Loading emergency workspace…</Card>
  }

  const patient = workspace.encounter.patient
  const age = Math.floor(
    (Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
        <ArrowLeft className="h-4 w-4" />
        Back to ED command center
      </button>

      <div className="sticky top-0 z-10 rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">
              {patient.firstName} {patient.lastName}
            </p>
            <p className="text-sm text-slate-600">
              MRN {patient.patientNo} · {age}y · {patient.gender}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Allergies:{' '}
              {workspace.allergies.length
                ? workspace.allergies.map((a) => a.allergen).join(', ')
                : 'None recorded'}
              {' · '}
              Chronic:{' '}
              {workspace.chronicConditions.length
                ? workspace.chronicConditions.map((c) => c.name).join(', ')
                : 'None'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-red-700">
              {workspace.triageCategory?.toUpperCase() ?? 'UNTRIAGED'}
            </p>
            <p className="text-xs capitalize text-slate-500">{workspace.workflowStage.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>

      <WorkspaceTabs active={tab} onChange={setTab} tabs={tabs.map((t) => ({ id: t.id, label: t.label }))} />

      {vitalsDue && workspace.status !== 'disposed' ? (
        <div className="critical-flash rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Vitals overdue — record now (every 3 minutes in ED).
          <button type="button" className="ml-3 underline" onClick={() => setTab('observation')}>
            Go to observation
          </button>
        </div>
      ) : null}

      {!workspace.triageCategory && focusTriage ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Complete emergency triage immediately after registration.
        </div>
      ) : null}

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <PageHeader title="Emergency triage" />
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); triage.mutate(e.currentTarget) }}>
              <SelectField name="triageCategory" label="Triage category" required>
                <option value="">Select</option>
                <option value="red">RED — Immediate</option>
                <option value="orange">ORANGE — Very urgent</option>
                <option value="yellow">YELLOW — Urgent</option>
                <option value="green">GREEN — Minor</option>
                <option value="black">BLACK — Deceased</option>
              </SelectField>
              <TextareaField name="notes" label="Triage notes" />
              <Button type="submit" loading={triage.isPending}>Save triage</Button>
            </form>
          </Card>
          <Card>
            <PageHeader title="Assign treatment bay" />
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); assignBay.mutate(e.currentTarget) }}>
              <SelectField name="bayId" label="Bay" required>
                <option value="">Select bay</option>
                {bays.map((bay) => (
                  <option key={bay.id} value={bay.id}>{bay.name}</option>
                ))}
              </SelectField>
              <Button type="submit" loading={assignBay.isPending}>Assign bay</Button>
            </form>
          </Card>
        </div>
      ) : null}

      {tab === 'notes' ? (
        <Card>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); addNote.mutate(e.currentTarget) }}>
            <SelectField name="noteType" label="Note type" required defaultValue="clinical">
              <option value="clinical">Clinical</option>
              <option value="nursing">Nursing</option>
              <option value="doctor">Doctor</option>
              <option value="handover">Handover</option>
            </SelectField>
            <TextareaField name="body" label="Note" required />
            <Button type="submit" loading={addNote.isPending}>Add note</Button>
          </form>
          <div className="mt-6 space-y-2">
            {workspace.notes.map((n) => (
              <div key={n.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs font-bold uppercase text-slate-500">{n.noteType}</p>
                <p>{n.body}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === 'orders' || tab === 'laboratory' || tab === 'radiology' ? (
        <ClinicalInvestigationOrders
          compact
          defaultMode={tab === 'radiology' ? 'radiology' : 'lab'}
          context={{
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            encounterId: workspace.encounter.id,
            encounterNo: workspace.encounter.encounterNo,
            defaultClinicalIndication: workspace.chiefComplaint ?? undefined,
          }}
        />
      ) : null}

      {tab === 'medication' ? (
        <Card className="p-5 md:p-6">
          <PageHeader title="ED medications" description="Document medications given in emergency. Full MAR continues in IPD after admission." />
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.currentTarget
              addMedication.mutate(form, { onSuccess: () => form.reset() })
            }}
          >
            <Field name="medication" label="Medication" required placeholder="e.g. Paracetamol" />
            <Field name="dose" label="Dose" required placeholder="e.g. 1g" />
            <Field name="route" label="Route" required placeholder="PO / IV / IM" />
            <TextareaField name="notes" label="Notes" />
            <Button type="submit" loading={addMedication.isPending}>Record administration</Button>
          </form>
        </Card>
      ) : null}

      {tab === 'timeline' ? (
        <PatientTimeline events={timeline?.events ?? []} title="Emergency timeline" description="Orders, results, notes, and disposition events." />
      ) : null}

      {tab === 'observation' ? (
        <Card>
          <PageHeader
            title="Observation & vitals monitoring"
            description={
              workspace.observationStartedAt
                ? `Started ${new Date(workspace.observationStartedAt).toLocaleString()} · repeat vitals every 3 minutes`
                : 'Record structured vitals every 3 minutes while the patient is in ED.'
            }
          />
          <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); addObservation.mutate(e.currentTarget) }}>
            <FormSection title="Structured vitals" columns={1}>
              <VitalsForm />
            </FormSection>
            <TextareaField name="nursingNotes" label="Nursing notes" />
            <TextareaField name="doctorReview" label="Doctor review" />
            <Button type="submit" loading={addObservation.isPending}>Log vitals & observation</Button>
          </form>
          <div className="mt-6 space-y-2">
            {workspace.observationLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-500">{new Date(log.recordedAt).toLocaleString()}</p>
                {log.vitalsSummary ? <p><strong>Vitals:</strong> {log.vitalsSummary}</p> : null}
                {log.nursingNotes ? <p><strong>Nursing:</strong> {log.nursingNotes}</p> : null}
                {log.doctorReview ? <p><strong>Doctor:</strong> {log.doctorReview}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === 'disposition' ? (
        <Card>
          <PageHeader title="Emergency outcome" description="Every patient must have a final disposition." />
          {isClosed ? (
            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
              <p className="font-semibold">Episode closed</p>
              <p className="mt-1 capitalize">Outcome: {(workspace.outcome ?? workspace.workflowStage).replace(/_/g, ' ')}</p>
            </div>
          ) : (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); disposition.mutate(e.currentTarget) }}>
            <SelectField
              name="outcome"
              label="Outcome"
              required
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            >
              <option value="">Select outcome</option>
              {outcomes.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectField>
            {outcome === 'admitted_ipd' ? (
              <>
                <SelectField name="bedId" label="Available IPD bed" required>
                  <option value="">Select a bed</option>
                  {availableBeds
                    .filter((bed) => !bed.status || bed.status === 'available')
                    .map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        {bed.ward?.name} · {bed.bedNo}
                      </option>
                    ))}
                </SelectField>
                <Field name="admissionReason" label="Admission reason" required />
              </>
            ) : null}
            <Field name="transferFacility" label="Transfer facility (if applicable)" />
            <TextareaField name="notes" label="Disposition notes" />
            <Button type="submit" loading={disposition.isPending}>Close emergency episode</Button>
          </form>
          )}
        </Card>
      ) : null}
    </div>
  )
}
