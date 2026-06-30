import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  Activity,
  ArrowLeft,
  ClipboardList,
  FileText,
  FlaskConical,
  Pill,
  Scan,
  Stethoscope,
} from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  ClinicalForm,
  CollapsibleSection,
  Field,
  FormActions,
  FormSection,
  SelectField,
  TextareaField,
} from '../ui'
import { PatientContextHeader } from '../PatientContextHeader'
import { PatientTimeline, type TimelineEvent } from '../PatientTimeline'
import { VitalsForm } from '../VitalsFields'
import { MarGrid, type MarEntry } from './MarGrid'
import { VitalsTrendPanel } from './VitalsTrendPanel'
import { ClinicalInvestigationOrders } from '../investigations/ClinicalInvestigationOrders'
import { calcLosDays } from './ipd-utils'
import { apiRequest } from '../../lib/api'
import { formDataFromElement, submitClinicalForm } from '../../lib/form-utils'
import { notify } from '../../lib/notify'

type WorkspaceTab =
  | 'overview'
  | 'timeline'
  | 'reviews'
  | 'nursing'
  | 'vitals'
  | 'medication'
  | 'laboratory'
  | 'radiology'
  | 'documents'
  | 'transfers'
  | 'discharge'

type ActionKey =
  | 'doctor-review'
  | 'nursing-note'
  | 'vitals'
  | 'lab'
  | 'radiology'
  | 'medication'
  | 'transfer'
  | 'discharge'
  | null

const tabs: { id: WorkspaceTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'reviews', label: 'Doctor Reviews' },
  { id: 'nursing', label: 'Nursing Notes' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'medication', label: 'Medication Chart' },
  { id: 'laboratory', label: 'Laboratory' },
  { id: 'radiology', label: 'Radiology' },
  { id: 'documents', label: 'Documents' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'discharge', label: 'Discharge' },
]

const actions: { id: ActionKey; label: string; icon: ReactNode; tab?: WorkspaceTab }[] = [
  { id: 'doctor-review', label: 'Doctor Review', icon: <Stethoscope className="h-4 w-4" />, tab: 'reviews' },
  { id: 'nursing-note', label: 'Nursing Note', icon: <ClipboardList className="h-4 w-4" />, tab: 'nursing' },
  { id: 'vitals', label: 'Vitals', icon: <Activity className="h-4 w-4" />, tab: 'vitals' },
  { id: 'lab', label: 'Lab Request', icon: <FlaskConical className="h-4 w-4" />, tab: 'laboratory' },
  { id: 'radiology', label: 'Radiology Request', icon: <Scan className="h-4 w-4" />, tab: 'radiology' },
  { id: 'medication', label: 'Medication Order', icon: <Pill className="h-4 w-4" />, tab: 'medication' },
  { id: 'transfer', label: 'Transfer', icon: <ArrowLeft className="h-4 w-4 rotate-180" />, tab: 'transfers' },
  { id: 'discharge', label: 'Discharge', icon: <FileText className="h-4 w-4" />, tab: 'discharge' },
]

export function PatientWorkspace({
  admissionId,
  onBack,
}: {
  admissionId: string
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview')
  const [activeAction, setActiveAction] = useState<ActionKey>(null)

  const { data: workspace, isLoading } = useQuery({
    queryKey: ['ipd-workspace', admissionId],
    queryFn: () =>
      apiRequest<{
        admission: {
          id: string
          admissionNo: string
          reason: string
          status: string
          type: string
          admittedAt: string
          patient: {
            id: string
            patientNo: string
            firstName: string
            lastName: string
            dateOfBirth: string
            gender: string
            primaryPhone?: string
            allergies?: { allergen: string; severity: string }[]
            chronicConditions?: { name: string; status: string }[]
            nextOfKin?: { name: string; relationship: string; primaryPhone: string }[]
          }
          bed: { bedNo: string }
          ward: { id: string; name: string; type: string }
          encounter?: { id: string; encounterNo: string } | null
        }
        progressNotes: {
          id: string
          subjective: string
          objective: string
          assessment: string
          plan: string
          createdAt: string
        }[]
        transfers: {
          id: string
          reason: string
          createdAt: string
          fromBed: { bedNo: string; ward: { name: string } }
          toBed: { bedNo: string; ward: { name: string } }
        }[]
        dischargeSummaries: {
          id: string
          status: string
          finalDiagnosis: string
          createdAt: string
        }[]
        lengthOfStayDays: number
      }>(`/inpatient/admissions/${admissionId}/workspace`),
  })

  const patientId = workspace?.admission.patient.id

  const { data: vitals = [] } = useQuery({
    queryKey: ['vitals', admissionId],
    queryFn: () =>
      apiRequest<
        {
          id: string
          recordedAt: string
          createdBy?: string | null
          recordedByName?: string
          temperature?: string | number | null
          pulse?: number | null
          respiratoryRate?: number | null
          bpSystolic?: number | null
          bpDiastolic?: number | null
          spo2?: number | null
          bloodGlucose?: string | number | null
        }[]
      >(`/nursing/vitals?admissionId=${admissionId}`),
    enabled: Boolean(admissionId),
  })

  const { data: mar = [] } = useQuery({
    queryKey: ['mar', admissionId],
    queryFn: () => apiRequest<MarEntry[]>(`/nursing/mar/${admissionId}`),
    enabled: Boolean(admissionId),
  })

  const { data: timeline = [] } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: () => apiRequest<TimelineEvent[]>(`/patients/${patientId}/timeline`),
    enabled: Boolean(patientId),
  })

  const { data: labRequests = [] } = useQuery({
    queryKey: ['lab-requests'],
    queryFn: () =>
      apiRequest<{ id: string; requestNo: string; status: string; patient: { id: string }; createdAt: string }[]>(
        '/laboratory/requests',
      ),
  })

  const { data: radiologyRequests = [] } = useQuery({
    queryKey: ['radiology-requests'],
    queryFn: () =>
      apiRequest<{ id: string; requestNo: string; status: string; patient: { id: string }; createdAt: string }[]>(
        '/radiology/requests',
      ),
  })

  const { data: observations = [] } = useQuery({
    queryKey: ['nursing-observations', admissionId],
    queryFn: () =>
      apiRequest<{ id: string; type: string; value: string; unit?: string; createdAt: string }[]>(
        `/nursing/observations/${admissionId}`,
      ),
    enabled: Boolean(admissionId),
  })

  const { data: availableBeds = [] } = useQuery({
    queryKey: ['available-beds'],
    queryFn: () =>
      apiRequest<{ id: string; bedNo: string; ward: { name: string } }[]>(
        '/inpatient/beds/available',
      ),
  })

  const patientLabs = useMemo(
    () => labRequests.filter((r) => r.patient?.id === patientId),
    [labRequests, patientId],
  )
  const patientRadiology = useMemo(
    () => radiologyRequests.filter((r) => r.patient?.id === patientId),
    [radiologyRequests, patientId],
  )

  const latestDiagnosis =
    workspace?.progressNotes[0]?.assessment || workspace?.admission.reason || '—'

  const addProgressNote = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/inpatient/admissions/${admissionId}/progress-notes`, {
        method: 'POST',
        body: JSON.stringify({
          subjective: form.get('subjective'),
          objective: form.get('objective'),
          assessment: form.get('assessment'),
          plan: form.get('plan'),
        }),
      })
    },
    onSuccess: async () => {
      notify('Progress note saved', 'Doctor review recorded.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['ipd-workspace', admissionId] })
      setActiveAction(null)
    },
  })

  const createVitals = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/nursing/vitals', {
        method: 'POST',
        body: JSON.stringify({
          admissionId,
          temperature: Number(form.get('temperature') || 0),
          pulse: Number(form.get('pulse') || 0),
          respiratoryRate: Number(form.get('respiratoryRate') || 0),
          bpSystolic: Number(form.get('bpSystolic') || 0),
          bpDiastolic: Number(form.get('bpDiastolic') || 0),
          spo2: Number(form.get('spo2') || 0),
          bloodGlucose: Number(form.get('bloodGlucose') || 0) || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Vitals recorded', 'Saved to chart.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['vitals', admissionId] })
      setActiveAction(null)
      setActiveTab('vitals')
    },
  })

  const createMar = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/nursing/mar', {
        method: 'POST',
        body: JSON.stringify({
          admissionId,
          medicationName: form.get('medicationName'),
          dosage: form.get('dosage'),
          route: form.get('route'),
          frequency: form.get('frequency'),
          scheduledTime: form.get('scheduledTime'),
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mar', admissionId] })
      setActiveAction(null)
    },
  })

  const createObservation = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/nursing/observations', {
        method: 'POST',
        body: JSON.stringify({
          admissionId,
          type: form.get('type'),
          value: form.get('value'),
          unit: form.get('unit') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Nursing note saved', 'Observation recorded.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['nursing-observations', admissionId] })
      setActiveAction(null)
    },
  })

  const transferBed = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/inpatient/admissions/${admissionId}/transfers`, {
        method: 'POST',
        body: JSON.stringify({
          toBedId: form.get('toBedId'),
          reason: form.get('reason'),
        }),
      })
    },
    onSuccess: async () => {
      notify('Transfer complete', 'Patient moved to new bed.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['ipd-workspace', admissionId] })
      setActiveAction(null)
    },
  })

  const createDischargeSummary = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/inpatient/admissions/${admissionId}/discharge-summary`, {
        method: 'POST',
        body: JSON.stringify({
          presentingComplaint: form.get('presentingComplaint'),
          history: form.get('history'),
          examOnAdmission: form.get('examOnAdmission'),
          investigationsSummary: form.get('investigationsSummary'),
          finalDiagnosis: form.get('finalDiagnosis'),
          treatmentGiven: form.get('treatmentGiven'),
          dischargeMeds: form.get('dischargeMeds'),
          followUpInstructions: form.get('followUpInstructions'),
          diet: form.get('diet') || undefined,
        }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ipd-workspace', admissionId] })
    },
  })

  const completeSummary = useMutation({
    mutationFn: (summaryId: string) =>
      apiRequest(`/inpatient/discharge-summaries/${summaryId}/complete`, { method: 'POST' }),
    onSuccess: async () => {
      notify('Discharge summary finalised', 'Ready for discharge.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['ipd-workspace', admissionId] })
    },
  })

  const dischargeAdmission = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest(`/inpatient/admissions/${admissionId}/discharge`, {
        method: 'POST',
        body: JSON.stringify({ conditionOnDischarge: form.get('conditionOnDischarge') }),
      })
    },
    onSuccess: async () => {
      notify('Patient discharged', 'Bed marked for cleaning.', 'success')
      onBack()
    },
  })

  if (isLoading || !workspace) {
    return <Card><p className="py-16 text-center text-slate-500">Loading patient workspace…</p></Card>
  }

  const { admission, progressNotes, transfers, dischargeSummaries, lengthOfStayDays } = workspace
  const patient = admission.patient
  const hasCompleteSummary = dischargeSummaries.some((s) => s.status === 'complete')
  const pendingLabs = patientLabs.filter((l) => !['verified', 'cancelled'].includes(l.status))
  const pendingRadiology = patientRadiology.filter(
    (r) => !['reported', 'reviewed', 'cancelled'].includes(r.status),
  )

  function handleAction(action: ActionKey) {
    setActiveAction(action)
    const match = actions.find((a) => a.id === action)
    if (match?.tab) setActiveTab(match.tab)
  }

  return (
    <div className="animate-fade-in space-y-10 pb-12">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to ward
      </Button>

      {/* ── TOP: Patient identity & admission strip ── */}
      <section className="sticky top-0 z-30 -mx-1 space-y-5 rounded-2xl bg-slate-50/95 px-1 py-2 backdrop-blur">
        <PatientContextHeader patient={patient} sticky={false} showWorkflow={false} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <AdmissionStat label="Ward" value={admission.ward.name} />
          <AdmissionStat label="Bed" value={admission.bed.bedNo} />
          <AdmissionStat label="Length of stay" value={`Day ${lengthOfStayDays}`} />
          <AdmissionStat label="Status" value={admission.status} capitalize />
          <AdmissionStat label="Diagnosis" value={latestDiagnosis} highlight />
        </div>
      </section>

      {/* ── Patient context cards (full width, stacked grid) ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Patient context</h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ContextCard title="Admission reason">
            <p className="text-base leading-relaxed text-slate-700">{admission.reason}</p>
          </ContextCard>
          <ContextCard title="Allergies">
            <TagList
              items={patient.allergies?.map((a) => a.allergen) ?? []}
              empty="None recorded"
              tone="danger"
            />
          </ContextCard>
          <ContextCard title="Chronic conditions">
            <TagList
              items={patient.chronicConditions?.map((c) => c.name) ?? []}
              empty="None recorded"
            />
          </ContextCard>
          <ContextCard title="Latest vitals">
            {vitals[0] ? (
              <div className="space-y-2">
                <p className="text-base font-semibold text-slate-800">
                  BP {vitals[0].bpSystolic}/{vitals[0].bpDiastolic} · P {vitals[0].pulse} · SpO₂ {vitals[0].spo2}%
                </p>
                <p className="text-sm text-slate-500">
                  {new Date(vitals[0].recordedAt).toLocaleString()} ·{' '}
                  {vitals[0].recordedByName ?? 'Unknown'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Not recorded yet</p>
            )}
          </ContextCard>
          <ContextCard title="Emergency contacts" className="md:col-span-2 xl:col-span-2">
            {patient.nextOfKin?.length ? (
              <ul className="space-y-3">
                {patient.nextOfKin.map((kin, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-800">
                      {kin.name}{' '}
                      <span className="font-normal text-slate-500">({kin.relationship})</span>
                    </span>
                    <span className="text-slate-600">{kin.primaryPhone}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">None recorded</p>
            )}
          </ContextCard>
        </div>
      </section>

      {/* ── Quick actions (horizontal, full width) ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Clinical actions</h3>
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAction(action.id)}
              className={clsx(
                'inline-flex items-center gap-2.5 rounded-xl border px-5 py-3 text-sm font-semibold shadow-sm transition',
                activeAction === action.id
                  ? 'border-teal-500 bg-teal-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50',
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Active action form (appears below actions, full width) ── */}
      {activeAction ? (
        <Card className="border-teal-200 bg-white p-8 shadow-md">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h3 className="text-xl font-bold text-slate-900">
              {actions.find((a) => a.id === activeAction)?.label}
            </h3>
            <Button variant="ghost" onClick={() => setActiveAction(null)}>
              Close
            </Button>
          </div>
          {activeAction === 'doctor-review' && (
            <ClinicalForm onSubmit={(e) => submitClinicalForm(addProgressNote, e)}>
              <FormSection title="SOAP note" columns={1}>
                <TextareaField name="subjective" label="Subjective" required rows={3} />
                <TextareaField name="objective" label="Objective" required rows={3} />
                <TextareaField name="assessment" label="Assessment / Diagnosis" required rows={3} />
                <TextareaField name="plan" label="Plan" required rows={3} />
              </FormSection>
              <FormActions>
                <Button type="submit" loading={addProgressNote.isPending}>Save review</Button>
              </FormActions>
            </ClinicalForm>
          )}
          {activeAction === 'nursing-note' && (
            <ClinicalForm onSubmit={(e) => submitClinicalForm(createObservation, e)}>
              <FormSection title="Nursing observation" columns={1}>
                <SelectField name="type" label="Type" required>
                  <option value="pain">Pain assessment</option>
                  <option value="wound">Wound care</option>
                  <option value="fluid_intake">Fluid intake</option>
                  <option value="fluid_output">Fluid output</option>
                  <option value="neuro">Neuro obs</option>
                  <option value="skin">Skin</option>
                </SelectField>
                <TextareaField name="value" label="Assessment & notes" required rows={5} />
                <Field name="unit" label="Unit (optional)" />
              </FormSection>
              <FormActions>
                <Button type="submit" loading={createObservation.isPending}>Save note</Button>
              </FormActions>
            </ClinicalForm>
          )}
          {activeAction === 'vitals' && (
            <ClinicalForm onSubmit={(e) => submitClinicalForm(createVitals, e)}>
              <VitalsForm />
              <FormActions>
                <Button type="submit" loading={createVitals.isPending}>Record vitals</Button>
              </FormActions>
            </ClinicalForm>
          )}
          {activeAction === 'medication' && (
            <ClinicalForm onSubmit={(e) => submitClinicalForm(createMar, e)}>
              <FormSection title="Medication order">
                <Field name="medicationName" label="Medication" required />
                <Field name="dosage" label="Dosage" required />
                <SelectField name="route" label="Route" required>
                  <option value="oral">Oral</option>
                  <option value="iv">IV</option>
                  <option value="im">IM</option>
                  <option value="sc">SC</option>
                </SelectField>
                <Field name="frequency" label="Frequency" required />
                <Field name="scheduledTime" label="Scheduled time" type="datetime-local" required />
              </FormSection>
              <FormActions>
                <Button type="submit" loading={createMar.isPending}>Add to MAR</Button>
              </FormActions>
            </ClinicalForm>
          )}
          {activeAction === 'transfer' && (
            <ClinicalForm onSubmit={(e) => submitClinicalForm(transferBed, e)}>
              <FormSection title="Bed transfer">
                <SelectField name="toBedId" label="Destination bed" required>
                  <option value="">Select bed</option>
                  {availableBeds.map((bed) => (
                    <option key={bed.id} value={bed.id}>
                      {bed.ward.name} · {bed.bedNo}
                    </option>
                  ))}
                </SelectField>
                <Field name="reason" label="Reason" required />
              </FormSection>
              <FormActions>
                <Button type="submit" loading={transferBed.isPending}>Transfer patient</Button>
              </FormActions>
            </ClinicalForm>
          )}
          {activeAction === 'discharge' && (
            <Alert tone="info">
              Complete the discharge checklist in the Discharge tab before final discharge.
            </Alert>
          )}
          {(activeAction === 'lab' || activeAction === 'radiology') && admission ? (
            <ClinicalInvestigationOrders
              defaultMode={activeAction === 'radiology' ? 'radiology' : 'lab'}
              context={{
                patientId: admission.patient.id,
                patientName: `${admission.patient.firstName} ${admission.patient.lastName}`,
                admissionId: admission.id,
                admissionNo: admission.admissionNo,
                encounterId: admission.encounter?.id ?? null,
                encounterNo: admission.encounter?.encounterNo ?? null,
                wardName: admission.ward.name,
                defaultClinicalIndication: admission.reason,
              }}
              onSuccess={() => {
                setActiveAction(null)
                setActiveTab(activeAction === 'lab' ? 'laboratory' : 'radiology')
              }}
            />
          ) : null}
        </Card>
      ) : null}

      {/* ── Workspace tabs ── */}
      <section className="space-y-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Clinical chart</h3>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                activeTab === tab.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Card className="min-h-[28rem] p-8">
          {activeTab === 'overview' && (
            <OverviewTab
              admission={admission}
              los={lengthOfStayDays}
              diagnosis={latestDiagnosis}
              pendingLabs={pendingLabs.length}
              pendingRadiology={pendingRadiology.length}
              marCount={mar.length}
              reviewDue={progressNotes.length === 0 || calcLosDays(admission.admittedAt) >= 1}
              latestVitals={vitals[0]}
            />
          )}
          {activeTab === 'timeline' && (
            <PatientTimeline events={timeline} title="Clinical timeline" description="Chronological patient journey." />
          )}
          {activeTab === 'reviews' && (
            <DoctorReviewsTab notes={progressNotes} onAdd={() => handleAction('doctor-review')} />
          )}
          {activeTab === 'nursing' && (
            <NursingNotesTab observations={observations} onAdd={() => handleAction('nursing-note')} />
          )}
          {activeTab === 'vitals' && (
            <VitalsTrendPanel vitals={vitals} onRecord={() => handleAction('vitals')} />
          )}
          {activeTab === 'medication' && <MarGrid entries={mar} />}
          {activeTab === 'laboratory' && (
            <div className="space-y-6">
              {admission ? (
                <ClinicalInvestigationOrders
                  compact
                  defaultMode="lab"
                  context={{
                    patientId: admission.patient.id,
                    patientName: `${admission.patient.firstName} ${admission.patient.lastName}`,
                    admissionId: admission.id,
                    admissionNo: admission.admissionNo,
                    encounterId: admission.encounter?.id ?? null,
                    encounterNo: admission.encounter?.encounterNo ?? null,
                    wardName: admission.ward.name,
                    defaultClinicalIndication: admission.reason,
                  }}
                  onSuccess={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['lab-requests'] })
                  }}
                />
              ) : null}
              <InvestigationList items={patientLabs} type="lab" />
            </div>
          )}
          {activeTab === 'radiology' && (
            <div className="space-y-6">
              {admission ? (
                <ClinicalInvestigationOrders
                  compact
                  defaultMode="radiology"
                  context={{
                    patientId: admission.patient.id,
                    patientName: `${admission.patient.firstName} ${admission.patient.lastName}`,
                    admissionId: admission.id,
                    admissionNo: admission.admissionNo,
                    encounterId: admission.encounter?.id ?? null,
                    encounterNo: admission.encounter?.encounterNo ?? null,
                    wardName: admission.ward.name,
                    defaultClinicalIndication: admission.reason,
                  }}
                  onSuccess={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['radiology-requests'] })
                  }}
                />
              ) : null}
              <InvestigationList items={patientRadiology} type="radiology" />
            </div>
          )}
          {activeTab === 'documents' && (
            <DocumentsTab summaries={dischargeSummaries} labs={patientLabs} radiology={patientRadiology} />
          )}
          {activeTab === 'transfers' && <TransfersTab transfers={transfers} ward={admission.ward.name} />}
          {activeTab === 'discharge' && (
            <DischargeTab
              summaries={dischargeSummaries}
              hasCompleteSummary={hasCompleteSummary}
              onComplete={(id) => completeSummary.mutate(id)}
              onDischarge={(e) => submitClinicalForm(dischargeAdmission, e)}
              onCreateSummary={(e) => submitClinicalForm(createDischargeSummary, e)}
              dischargePending={dischargeAdmission.isPending}
            />
          )}
        </Card>
      </section>
    </div>
  )
}

function AdmissionStat({
  label,
  value,
  highlight,
  capitalize,
}: {
  label: string
  value: string
  highlight?: boolean
  capitalize?: boolean
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border px-5 py-4 shadow-sm',
        highlight ? 'border-teal-200 bg-teal-50/80' : 'border-slate-200 bg-white',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={clsx(
          'mt-2 text-base font-bold leading-snug',
          highlight ? 'text-teal-900' : 'text-slate-900',
          capitalize && 'capitalize',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function ContextCard({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('rounded-2xl border border-slate-200 bg-white p-6 shadow-sm', className)}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function TagList({
  items,
  empty,
  tone,
}: {
  items: string[]
  empty: string
  tone?: 'danger'
}) {
  if (!items.length) return <p className="text-sm text-slate-400">{empty}</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className={clsx(
            'rounded-full px-3 py-1 text-xs font-semibold',
            tone === 'danger' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700',
          )}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function OverviewTab({
  admission,
  los,
  diagnosis,
  pendingLabs,
  pendingRadiology,
  marCount,
  reviewDue,
  latestVitals,
}: {
  admission: { reason: string; ward: { name: string }; bed: { bedNo: string }; status: string }
  los: number
  diagnosis: string
  pendingLabs: number
  pendingRadiology: number
  marCount: number
  reviewDue: boolean
  latestVitals?: {
    recordedAt: string
    recordedByName?: string
    bpSystolic?: number | null
    bpDiastolic?: number | null
    pulse?: number | null
    spo2?: number | null
  }
}) {
  const tiles = [
    { label: 'Current diagnosis', value: diagnosis },
    { label: 'Admission reason', value: admission.reason },
    { label: 'Length of stay', value: `${los} day${los === 1 ? '' : 's'}` },
    { label: 'Bed', value: `${admission.ward.name} · ${admission.bed.bedNo}` },
    { label: 'Patient status', value: admission.status },
    { label: 'Pending labs', value: String(pendingLabs) },
    { label: 'Pending radiology', value: String(pendingRadiology) },
    { label: 'Medications on chart', value: String(marCount) },
    { label: 'Doctor review', value: reviewDue ? 'Due today' : 'Up to date' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Bedside summary</h3>
        <p className="mt-2 text-sm text-slate-500">Understand this patient in 5 seconds.</p>
      </div>

      {latestVitals ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-6">
          <p className="text-xs font-bold uppercase text-teal-700">Latest vitals</p>
          <p className="mt-2 text-lg font-bold text-slate-900">
            BP {latestVitals.bpSystolic}/{latestVitals.bpDiastolic} · Pulse {latestVitals.pulse} · SpO₂ {latestVitals.spo2}%
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Taken {new Date(latestVitals.recordedAt).toLocaleString()} by{' '}
            {latestVitals.recordedByName ?? 'Unknown'}
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-slate-100 bg-slate-50/80 p-5">
            <p className="text-xs font-bold uppercase text-slate-500">{tile.label}</p>
            <p className="mt-2 text-base font-semibold leading-relaxed text-slate-900">{tile.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DoctorReviewsTab({
  notes,
  onAdd,
}: {
  notes: { id: string; subjective: string; objective: string; assessment: string; plan: string; createdAt: string }[]
  onAdd: () => void
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Doctor reviews</h3>
          <p className="mt-1 text-sm text-slate-500">Round-based SOAP notes and plans.</p>
        </div>
        <Button onClick={onAdd}>New review</Button>
      </div>
      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
          No progress notes yet.
        </p>
      ) : (
        <div className="space-y-5">
          {notes.map((note) => (
            <div key={note.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                {new Date(note.createdAt).toLocaleString()}
              </p>
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <NoteBlock label="Subjective" value={note.subjective} />
                <NoteBlock label="Objective" value={note.objective} />
                <NoteBlock label="Assessment" value={note.assessment} />
                <NoteBlock label="Plan" value={note.plan} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{value}</p>
    </div>
  )
}

function NursingNotesTab({
  observations,
  onAdd,
}: {
  observations: { id: string; type: string; value: string; createdAt: string }[]
  onAdd: () => void
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Nursing notes</h3>
          <p className="mt-1 text-sm text-slate-500">Shift observations and nursing assessments.</p>
        </div>
        <Button onClick={onAdd}>Add note</Button>
      </div>
      {observations.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
          No nursing observations yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {observations.map((obs) => (
            <li key={obs.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {obs.type.replace('_', ' ')} · {new Date(obs.createdAt).toLocaleString()}
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-700">{obs.value}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function InvestigationList({
  items,
  type,
}: {
  items: { id: string; requestNo: string; status: string; createdAt: string }[]
  type: 'lab' | 'radiology'
}) {
  const statusFlow =
    type === 'lab'
      ? ['requested', 'sample_collected', 'processing', 'resulted', 'verified']
      : ['requested', 'scheduled', 'in_progress', 'reported', 'reviewed']

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{type === 'lab' ? 'Laboratory' : 'Radiology'}</h3>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No requests for this patient.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">{item.requestNo}</p>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {statusFlow.map((step) => (
                <span
                  key={step}
                  className={clsx(
                    'rounded px-2 py-0.5 text-[10px] font-bold uppercase',
                    step === item.status ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400',
                  )}
                >
                  {step.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tones: Record<string, string> = {
    requested: 'bg-amber-100 text-amber-900',
    verified: 'bg-emerald-100 text-emerald-900',
    reported: 'bg-emerald-100 text-emerald-900',
    processing: 'bg-sky-100 text-sky-900',
    critical: 'bg-red-100 text-red-900',
  }
  return (
    <span className={clsx('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase', tones[status] ?? 'bg-slate-100 text-slate-700')}>
      {status.replace('_', ' ')}
    </span>
  )
}

function DocumentsTab({
  summaries,
  labs,
  radiology,
}: {
  summaries: { id: string; status: string; finalDiagnosis: string; createdAt: string }[]
  labs: { requestNo: string; status: string }[]
  radiology: { requestNo: string; status: string }[]
}) {
  const docs = [
    ...summaries.map((s) => ({
      name: `Discharge summary — ${s.finalDiagnosis}`,
      date: s.createdAt,
      status: s.status,
    })),
    ...labs.filter((l) => l.status === 'verified').map((l) => ({
      name: `Lab report — ${l.requestNo}`,
      date: '',
      status: 'available',
    })),
    ...radiology.filter((r) => ['reported', 'reviewed'].includes(r.status)).map((r) => ({
      name: `Radiology report — ${r.requestNo}`,
      date: '',
      status: 'available',
    })),
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Documents</h3>
      {docs.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {docs.map((doc, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">{doc.name}</p>
                {doc.date ? (
                  <p className="text-xs text-slate-500">{new Date(doc.date).toLocaleDateString()}</p>
                ) : null}
              </div>
              <StatusBadge status={doc.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TransfersTab({
  transfers,
  ward,
}: {
  transfers: {
    id: string
    reason: string
    createdAt: string
    fromBed: { bedNo: string; ward: { name: string } }
    toBed: { bedNo: string; ward: { name: string } }
  }[]
  ward: string
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Transfer history</h3>
      <p className="text-sm text-slate-500">Current ward: {ward}</p>
      {transfers.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No transfers recorded.</p>
      ) : (
        <div className="space-y-4">
          {transfers.map((t) => (
            <div key={t.id} className="flex items-center gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                <p className="text-xs text-slate-500">{t.fromBed.ward.name}</p>
                <p className="font-bold">{t.fromBed.bedNo}</p>
              </div>
              <div className="text-2xl text-slate-300">↓</div>
              <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-center">
                <p className="text-xs text-teal-600">{t.toBed.ward.name}</p>
                <p className="font-bold text-teal-900">{t.toBed.bedNo}</p>
              </div>
              <div className="flex-1 text-sm text-slate-600">
                <p>{new Date(t.createdAt).toLocaleString()}</p>
                <p className="text-slate-500">{t.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DischargeTab({
  summaries,
  hasCompleteSummary,
  onComplete,
  onDischarge,
  onCreateSummary,
  dischargePending,
}: {
  summaries: { id: string; status: string; finalDiagnosis: string }[]
  hasCompleteSummary: boolean
  onComplete: (id: string) => void
  onDischarge: (e: FormEvent<HTMLFormElement>) => void
  onCreateSummary: (e: FormEvent<HTMLFormElement>) => void
  dischargePending: boolean
}) {
  const checklist = [
    { label: 'Doctor review complete', done: summaries.length > 0 },
    { label: 'Lab results reviewed', done: true },
    { label: 'Radiology reviewed', done: true },
    { label: 'Medication reconciliation complete', done: true },
    { label: 'Discharge summary complete', done: hasCompleteSummary },
  ]
  const allDone = checklist.every((c) => c.done)

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Discharge checklist</h3>
      <ul className="space-y-2">
        {checklist.map((item) => (
          <li
            key={item.label}
            className={clsx(
              'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium',
              item.done ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            <span>{item.done ? '✓' : '○'}</span>
            {item.label}
          </li>
        ))}
      </ul>

      <CollapsibleSection title="Create discharge summary" defaultOpen={!hasCompleteSummary}>
        <ClinicalForm onSubmit={onCreateSummary}>
          <FormSection title="Summary">
            <Field name="presentingComplaint" label="Presenting complaint" required />
            <TextareaField name="history" label="History" required rows={2} />
            <TextareaField name="examOnAdmission" label="Exam on admission" required rows={2} />
            <TextareaField name="investigationsSummary" label="Investigations" required rows={2} />
            <Field name="finalDiagnosis" label="Final diagnosis" required />
            <TextareaField name="treatmentGiven" label="Treatment given" required rows={2} />
            <TextareaField name="dischargeMeds" label="Discharge medications" required rows={2} />
            <TextareaField name="followUpInstructions" label="Follow-up" required rows={2} />
            <Field name="diet" label="Diet" />
          </FormSection>
          <FormActions>
            <Button type="submit">Save draft summary</Button>
          </FormActions>
        </ClinicalForm>
      </CollapsibleSection>

      {summaries.filter((s) => s.status === 'draft').map((s) => (
        <Button key={s.id} variant="secondary" onClick={() => onComplete(s.id)}>
          Finalise summary: {s.finalDiagnosis}
        </Button>
      ))}

      <ClinicalForm onSubmit={onDischarge}>
        <FormSection title="Discharge">
          <SelectField name="conditionOnDischarge" label="Condition on discharge" required>
            <option value="improved">Improved</option>
            <option value="same">Same</option>
            <option value="deteriorated">Deteriorated</option>
            <option value="died">Died</option>
            <option value="absconded">Absconded</option>
          </SelectField>
        </FormSection>
        {!allDone ? (
          <Alert tone="warning">Complete all checklist items before discharge.</Alert>
        ) : null}
        <FormActions>
          <Button type="submit" loading={dischargePending} disabled={!allDone}>
            Discharge patient
          </Button>
        </FormActions>
      </ClinicalForm>
    </div>
  )
}
