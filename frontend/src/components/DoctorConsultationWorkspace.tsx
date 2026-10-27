import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BedDouble,
  ClipboardList,
  FileText,
  FlaskConical,
  History,
  Inbox,
  Landmark,
  Paperclip,
  Pill,
  Printer,
  Stethoscope,
} from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  ClinicalForm,
  Field,
  FormActions,
  FormSection,
  PageHeader,
  SelectField,
  TextareaField,
} from './ui'
import { IpdAdmitPanel } from './ipd/IpdAdmitPanel'
import { PatientContextHeader } from './PatientContextHeader'
import { PatientTimeline, type TimelineEvent } from './PatientTimeline'
import { TriageSummaryPanel } from './VitalsFields'
import { ClinicalInvestigationOrders } from './investigations/ClinicalInvestigationOrders'
import {
  ConsultationResultsPanel,
  useConsultationInvestigations,
} from './investigations/ConsultationResultsPanel'
import { EncounterAttachmentsPanel } from './documents/EncounterAttachmentsPanel'
import { WorkspaceTabs } from './ui/WorkspaceTabs'
import {
  PrescriptionForm,
  PrescriptionOrdersList,
  type PersistedPharmacyOrder,
} from './orders/PrescriptionForm'
import { apiRequest, formatApiError } from '../lib/api'
import { formatKes } from '../lib/clinical-catalog'
import { listPatientPayments } from '../lib/payments'
import { notify } from '../lib/notify'
import { useAuthStore } from '../lib/auth-store'
import type { WorkflowStep } from '../lib/workflow-status'
import { mapEncounterStatusToWorkflow } from '../lib/workflow-status'

export type ConsultationPatient = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  middleName?: string | null
  dateOfBirth: string
  gender: string
  primaryPhone: string
  secondaryPhone?: string | null
  email?: string | null
  bloodGroup?: string | null
  county?: string | null
  subCounty?: string | null
  identifiers?: { type: string; value: string }[]
  nextOfKin?: { name: string; relationship: string; primaryPhone: string; isEmergencyContact?: boolean }[]
  allergies?: { allergen: string; severity: string }[]
  chronicConditions?: { name: string; status: string }[]
}

export type ConsultationEncounter = {
  id: string
  encounterNo: string
  status?: string
  presentingComplaint?: string
  startedAt?: string
  visitType?: string | null
  referralSource?: string | null
  referralReason?: string | null
  departmentName?: string | null
  attendingDoctor?: { id: string; firstName: string; lastName: string } | null
  patient: ConsultationPatient
  triage?: {
    colour: string
    category?: string
    chiefComplaint?: string
    painScore?: number | null
    temperature?: string | number | null
    pulse?: number | null
    respiratoryRate?: number | null
    bpSystolic?: number | null
    bpDiastolic?: number | null
    spo2?: number | null
    weight?: string | number | null
    height?: string | number | null
  } | null
}

type EncounterDetailResponse = ConsultationEncounter & {
  consultation?: {
    id: string
    status: string
    subjective: string
    objective: string
    assessment: string
    plan: string
    followUpDate?: string | null
    followUpInstructions?: string | null
    createdAt: string
    completedAt?: string | null
  } | null
  diagnoses?: Array<{
    id: string
    icd10Code?: string | null
    description: string
    type: string
    confirmed?: boolean
    createdAt: string
  }>
  notes?: Array<{
    id: string
    note: string
    category?: string
    createdAt: string
  }>
}

type EncounterSummaryRow = {
  id: string
  encounterNo: string
  status: string
  startedAt: string
  endedAt?: string | null
  visitType?: string | null
  departmentName?: string | null
  presentingComplaint?: string | null
  attendingDoctor?: { id: string; firstName: string; lastName: string } | null
}

type ChargeRow = {
  id: string
  serviceLine: string
  serviceDescription: string
  amountOwed: string
  amountPaid: string
  amountWaived?: string
  status: string
  createdAt: string
  metadata?: Record<string, unknown> | null
}

type DoctorTab =
  | 'context'
  | 'soap'
  | 'orders'
  | 'results'
  | 'meds'
  | 'billing'
  | 'history'
  | 'referrals'
  | 'files'
  | 'disposition'

export function DoctorConsultationWorkspace({
  selected,
  createConsultation,
  addDiagnosis,
  completeEncounter,
  createReferral,
  recentSoap,
  onOpenIpd,
  onOpenSickSheets,
}: {
  selected: ConsultationEncounter
  createConsultation: {
    mutate: (form: HTMLFormElement) => void
    isPending: boolean
  }
  addDiagnosis: { mutate: (form: HTMLFormElement) => void; isPending: boolean }
  completeEncounter: { mutate: () => void; isPending: boolean }
  createReferral: { mutate: (form: HTMLFormElement) => void; isPending: boolean }
  recentSoap: Array<{ id: string; patient: string; savedAt: string }>
  onOpenIpd?: (admissionId: string) => void
  onOpenSickSheets?: () => void
}) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<DoctorTab>('context')
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const canSeePayments =
    permissions.includes('payments:read') ||
    permissions.includes('payments:initiate') ||
    permissions.includes('settings:manage')

  const investigations = useConsultationInvestigations(selected.patient.id, selected.id)

  useEffect(() => {
    setTab(selected.status === 'awaiting_results' ? 'results' : 'context')
  }, [selected.id])

  const {
    data: patientDetail,
    isLoading: patientLoading,
    error: patientError,
  } = useQuery({
    queryKey: ['patient', selected.patient.id],
    queryFn: () => apiRequest<ConsultationPatient>(`/patients/${selected.patient.id}`),
  })

  const {
    data: encounterDetail,
    isLoading: encounterLoading,
    error: encounterError,
  } = useQuery({
    queryKey: ['opd-encounter-detail', selected.id],
    queryFn: () => apiRequest<EncounterDetailResponse>(`/opd/encounters/${selected.id}`),
  })

  const {
    data: timeline,
    isLoading: timelineLoading,
    error: timelineError,
    refetch: refetchTimeline,
  } = useQuery({
    queryKey: ['consultation-timeline', selected.patient.id],
    queryFn: () =>
      apiRequest<{ events: TimelineEvent[] }>(`/patients/${selected.patient.id}/timeline`),
  })

  const { data: journey } = useQuery({
    queryKey: ['patient-journey', selected.patient.id],
    queryFn: () =>
      apiRequest<{
        step: WorkflowStep
        pregnancyAlert: boolean
        criticalLabAlert: boolean
      }>(`/patients/${selected.patient.id}/journey`),
  })

  const {
    data: pharmacyOrders = [],
    isLoading: pharmacyLoading,
    error: pharmacyError,
    refetch: refetchPharmacy,
  } = useQuery({
    queryKey: ['consultation-pharmacy', selected.patient.id],
    queryFn: () =>
      apiRequest<PersistedPharmacyOrder[]>(
        `/clinical-orders?module=pharmacy&patientId=${selected.patient.id}&limit=80`,
      ),
  })

  const {
    data: allEncounters = [],
    isLoading: encountersLoading,
    error: encountersError,
  } = useQuery({
    queryKey: ['patient-encounters', selected.patient.id],
    queryFn: () =>
      apiRequest<EncounterSummaryRow[]>(`/opd/encounters?patientId=${selected.patient.id}`),
    retry: false,
  })

  const {
    data: referralsChart,
    isLoading: referralsLoading,
    error: referralsError,
  } = useQuery({
    queryKey: ['patient-chart', selected.patient.id, 'referrals'],
    queryFn: () =>
      apiRequest<{
        items: Array<{ id: string; title: string; status?: string | null; occurredAt: string; summary?: string | null }>
      }>(`/patients/${selected.patient.id}/chart?section=referrals`),
    enabled: tab === 'referrals' || tab === 'context',
    retry: false,
  })

  const {
    data: charges = [],
    isLoading: chargesLoading,
    error: chargesError,
  } = useQuery({
    queryKey: ['patient-charges', selected.patient.id],
    queryFn: () =>
      apiRequest<ChargeRow[]>(`/payments/charges?patientId=${selected.patient.id}`),
    enabled: canSeePayments && (tab === 'billing' || tab === 'context'),
    retry: false,
  })

  const {
    data: payments = [],
    isLoading: paymentsLoading,
    error: paymentsError,
  } = useQuery({
    queryKey: ['patient-payments', selected.patient.id],
    queryFn: () => listPatientPayments(selected.patient.id),
    enabled: canSeePayments && (tab === 'billing' || tab === 'context'),
    retry: false,
  })

  const markAwaitingResults = useMutation({
    mutationFn: () =>
      apiRequest(`/opd/encounters/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'awaiting_results' }),
      }),
    onSuccess: async () => {
      notify('Awaiting results', 'Encounter moved to awaiting results.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      await queryClient.invalidateQueries({ queryKey: ['opd-encounter-detail', selected.id] })
    },
    onError: (error: Error) => notify('Cannot change status', error.message, 'critical'),
  })

  const patient = patientDetail ?? selected.patient
  const triage = encounterDetail?.triage ?? selected.triage ?? null
  const activeConsultation = encounterDetail?.consultation ?? null
  const diagnoses = encounterDetail?.diagnoses ?? []
  const previousEncounters = useMemo(
    () => allEncounters.filter((enc) => enc.id !== selected.id),
    [allEncounters, selected.id],
  )
  const currentEncounterRx = useMemo(
    () =>
      pharmacyOrders.filter(
        (order) => !order.encounter?.id || order.encounter.id === selected.id,
      ),
    [pharmacyOrders, selected.id],
  )
  const historicalRx = useMemo(
    () =>
      pharmacyOrders.filter(
        (order) => order.encounter?.id && order.encounter.id !== selected.id,
      ),
    [pharmacyOrders, selected.id],
  )

  const workflowStep = journey?.step ?? mapEncounterStatusToWorkflow('in_consultation')

  function changeTab(next: DoctorTab) {
    if (!next) return
    setTab(next)
  }

  function tryCompleteVisit() {
    if (investigations.unreviewedCount > 0) {
      notify(
        'Review results first',
        investigations.unreviewedCritical
          ? `${investigations.unreviewedCritical} critical result(s) still need review.`
          : `${investigations.unreviewedCount} verified result(s) still need review.`,
        'critical',
      )
      setTab('results')
      return
    }
    completeEncounter.mutate()
  }

  const assignedClinician = encounterDetail?.attendingDoctor ?? selected.attendingDoctor

  return (
    <div className="workspace-shell space-y-4">
      <PatientContextHeader
        patient={patient}
        workflowStep={workflowStep}
        pregnancyAlert={journey?.pregnancyAlert}
        criticalLabAlert={journey?.criticalLabAlert}
      />

      <WorkspaceTabs
        active={tab}
        onChange={changeTab}
        tabs={[
          { id: 'context', label: 'OPD Profile & Context', icon: <ClipboardList className="h-4 w-4" /> },
          { id: 'soap', label: 'Consultation & Diagnoses', icon: <Stethoscope className="h-4 w-4" /> },
          { id: 'meds', label: 'Prescriptions', icon: <Pill className="h-4 w-4" /> },
          { id: 'orders', label: 'Lab & Imaging Orders', icon: <FlaskConical className="h-4 w-4" /> },
          {
            id: 'results',
            label: investigations.unreviewedCount
              ? `Results (${investigations.unreviewedCount})`
              : 'Results',
            icon: <Inbox className="h-4 w-4" />,
          },
          { id: 'billing', label: 'Billing & Clearance', icon: <Landmark className="h-4 w-4" /> },
          { id: 'history', label: 'Past Visits & Meds', icon: <History className="h-4 w-4" /> },
          { id: 'referrals', label: 'Referrals', icon: <FileText className="h-4 w-4" /> },
          { id: 'disposition', label: 'Disposition', icon: <BedDouble className="h-4 w-4" /> },
          { id: 'files', label: 'Files', icon: <Paperclip className="h-4 w-4" /> },
        ]}
      />

      {tab === 'context' ? (
        <div className="space-y-5">
          {patientError ? (
            <Alert tone="error">{formatApiError(patientError, 'Could not load patient demographics.')}</Alert>
          ) : null}
          {encounterError ? (
            <Alert tone="error">{formatApiError(encounterError, 'Could not load active OPD encounter details.')}</Alert>
          ) : null}

          {/* Sections 1, 2 & 3: Demographics, Active OPD Encounter, Triage & Vitals */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Active OPD Encounter',
                value: `${encounterDetail?.encounterNo ?? selected.encounterNo} (${(
                  encounterDetail?.status ??
                  selected.status ??
                  'in_consultation'
                ).replace(/_/g, ' ')})`,
              },
              {
                label: 'Visit Date & Department',
                value: `${
                  encounterDetail?.startedAt || selected.startedAt
                    ? new Date((encounterDetail?.startedAt ?? selected.startedAt)!).toLocaleString()
                    : 'Today'
                } · ${encounterDetail?.departmentName ?? selected.departmentName ?? 'OPD'}`,
              },
              {
                label: 'Assigned Clinician & Referral Source',
                value: `${
                  assignedClinician
                    ? `Dr. ${assignedClinician.firstName} ${assignedClinician.lastName}`
                    : 'Any OPD Clinician'
                }${
                  encounterDetail?.referralSource
                    ? ` · Ref: ${encounterDetail.referralSource}`
                    : ''
                }`,
              },
              {
                label: 'Presenting / Chief Complaint',
                value:
                  triage?.chiefComplaint ??
                  encounterDetail?.presentingComplaint ??
                  selected.presentingComplaint ??
                  'Not recorded',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                1. Patient Identity & Contacts
              </p>
              {patientLoading ? (
                <div className="mt-2 h-20 animate-skeleton rounded-xl" />
              ) : (
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  <p>
                    <strong>MRN:</strong> {patient.patientNo} · <strong>DOB:</strong>{' '}
                    {patient.dateOfBirth?.slice(0, 10) || '—'} · <strong>Sex:</strong> {patient.gender}
                  </p>
                  <p>
                    <strong>Phone:</strong> {patient.primaryPhone || '—'}
                    {patient.secondaryPhone ? ` / ${patient.secondaryPhone}` : ''}
                  </p>
                  <p>
                    <strong>Blood group:</strong> {patient.bloodGroup || '—'} ·{' '}
                    <strong>Residence:</strong> {[patient.county, patient.subCounty].filter(Boolean).join(', ') || '—'}
                  </p>
                  {patient.nextOfKin?.length ? (
                    <p className="text-xs text-slate-500">
                      <strong>Next of Kin:</strong> {patient.nextOfKin[0].name} ({patient.nextOfKin[0].relationship}) ·{' '}
                      {patient.nextOfKin[0].primaryPhone}
                    </p>
                  ) : null}
                </div>
              )}
            </Card>

            <Card className="border-rose-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
                3. Allergies & Medical History
              </p>
              <div className="mt-2 space-y-1.5 text-sm">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Allergies: </span>
                  {patient.allergies?.length ? (
                    <span className="font-semibold text-rose-800">
                      {patient.allergies.map((a) => `${a.allergen} (${a.severity})`).join(', ')}
                    </span>
                  ) : (
                    <span className="text-slate-500">No known allergies recorded</span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500">Chronic conditions: </span>
                  {patient.chronicConditions?.length ? (
                    <span className="font-medium text-slate-800">
                      {patient.chronicConditions.map((c) => `${c.name} (${c.status})`).join(', ')}
                    </span>
                  ) : (
                    <span className="text-slate-500">None recorded</span>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                4. Active Consultation & Diagnoses
              </p>
              {encounterLoading ? (
                <div className="mt-2 h-20 animate-skeleton rounded-xl" />
              ) : (
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {activeConsultation ? (
                    <>
                      <p className="line-clamp-2">
                        <strong>Assessment:</strong> {activeConsultation.assessment}
                      </p>
                      <p className="line-clamp-2">
                        <strong>Plan:</strong> {activeConsultation.plan}
                      </p>
                      {activeConsultation.followUpDate ? (
                        <p className="text-xs text-teal-800">
                          Follow-up: {activeConsultation.followUpDate.slice(0, 10)}{' '}
                          {activeConsultation.followUpInstructions ?? ''}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-slate-500">No SOAP note saved on this encounter yet.</p>
                  )}
                  {diagnoses.length ? (
                    <p className="text-xs font-medium text-slate-800">
                      <strong>Diagnoses ({diagnoses.length}):</strong>{' '}
                      {diagnoses
                        .map((d) => `${d.icd10Code ? `[${d.icd10Code}] ` : ''}${d.description}`)
                        .join(' · ')}
                    </p>
                  ) : null}
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {triage ? (
              <TriageSummaryPanel triage={triage} />
            ) : (
              <Card className="p-5">
                <p className="text-sm font-semibold text-slate-800">Triage & Vitals</p>
                <p className="mt-2 text-sm text-slate-500">No triage vitals recorded for this encounter.</p>
              </Card>
            )}

            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  5. Active Encounter Prescriptions
                </p>
                <Button type="button" variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setTab('meds')}>
                  Prescribe / View All
                </Button>
              </div>
              <div className="mt-3">
                <PrescriptionOrdersList
                  orders={currentEncounterRx}
                  isLoading={pharmacyLoading}
                  error={pharmacyError}
                  emptyMessage="No prescriptions written on this encounter yet."
                />
              </div>
            </Card>
          </div>

          {/* Section 10: Chronological Clinical Activity Timeline */}
          {timelineError ? (
            <Alert tone="error">
              {formatApiError(timelineError, 'Could not load clinical timeline.')}{' '}
              <button type="button" className="ml-2 underline" onClick={() => void refetchTimeline()}>
                Retry
              </button>
            </Alert>
          ) : timelineLoading ? (
            <div className="h-40 animate-skeleton rounded-2xl" />
          ) : (
            <PatientTimeline
              events={timeline?.events ?? []}
              title="10. Chronological Clinical Activity Timeline"
              description="Encounters, triage, consultations, diagnoses, prescriptions, dispenses, investigations, referrals, and billing events."
            />
          )}
        </div>
      ) : null}

      {tab === 'soap' ? (
        <div className="space-y-6">
          <Card className="p-5 md:p-8">
            <PageHeader
              title="4. Consultation Notes, Examination, Assessment & Care Plan"
              description={`Encounter ${selected.encounterNo}${
                activeConsultation ? ` · Saved (${activeConsultation.status})` : ''
              }`}
            />

            {activeConsultation ? (
              <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 text-sm text-teal-950">
                <p className="font-semibold">
                  Recorded Consultation Note ({new Date(activeConsultation.createdAt).toLocaleString()})
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
                  <p>
                    <strong>Subjective:</strong> {activeConsultation.subjective}
                  </p>
                  <p>
                    <strong>Objective / Exam:</strong> {activeConsultation.objective}
                  </p>
                  <p>
                    <strong>Assessment:</strong> {activeConsultation.assessment}
                  </p>
                  <p>
                    <strong>Care Plan:</strong> {activeConsultation.plan}
                  </p>
                  {activeConsultation.followUpDate || activeConsultation.followUpInstructions ? (
                    <p className="sm:col-span-2">
                      <strong>Follow-up:</strong> {activeConsultation.followUpDate?.slice(0, 10) ?? '—'}{' '}
                      {activeConsultation.followUpInstructions ?? ''}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <ClinicalForm
              key={activeConsultation?.id ?? selected.id}
              onSubmit={(event) => {
                event.preventDefault()
                createConsultation.mutate(event.currentTarget)
                void queryClient.invalidateQueries({ queryKey: ['opd-encounter-detail', selected.id] })
              }}
            >
              <FormSection title="Subjective & objective" columns={1}>
                <TextareaField
                  name="subjective"
                  label="Subjective"
                  placeholder="History, symptoms, HPI"
                  defaultValue={activeConsultation?.subjective ?? ''}
                  required
                />
                <TextareaField
                  name="objective"
                  label="Objective / Examination"
                  placeholder="Physical examination findings"
                  defaultValue={activeConsultation?.objective ?? ''}
                  required
                />
              </FormSection>
              <FormSection title="Assessment & care plan" columns={1}>
                <TextareaField
                  name="assessment"
                  label="Assessment"
                  defaultValue={activeConsultation?.assessment ?? ''}
                  required
                />
                <TextareaField
                  name="plan"
                  label="Care Plan"
                  defaultValue={activeConsultation?.plan ?? ''}
                  required
                />
                <Field
                  name="followUpDate"
                  label="Follow-up date"
                  type="date"
                  defaultValue={activeConsultation?.followUpDate?.slice(0, 10) ?? ''}
                />
                <Field
                  name="followUpInstructions"
                  label="Follow-up instructions"
                  defaultValue={activeConsultation?.followUpInstructions ?? ''}
                />
              </FormSection>
              <FormActions>
                <Button type="submit" loading={createConsultation.isPending} className="min-h-12">
                  Save SOAP
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  loading={completeEncounter.isPending}
                  className="min-h-12"
                  onClick={tryCompleteVisit}
                >
                  Complete visit
                </Button>
              </FormActions>
            </ClinicalForm>

            <form
              className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                const form = event.currentTarget
                addDiagnosis.mutate(form)
                void queryClient.invalidateQueries({ queryKey: ['opd-encounter-detail', selected.id] })
              }}
            >
              <p className="md:col-span-2 text-sm font-bold text-slate-800">Add diagnosis</p>
              <Field name="icd10Code" label="ICD-10 code" />
              <Field name="description" label="Diagnosis" required />
              <div className="md:col-span-2">
                <SelectField name="type" label="Type" required defaultValue="primary">
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="differential">Differential</option>
                </SelectField>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" loading={addDiagnosis.isPending} className="min-h-12">
                  Add diagnosis
                </Button>
              </div>
            </form>

            {diagnoses.length ? (
              <div className="mt-6">
                <p className="text-sm font-bold text-slate-800">Recorded Diagnoses on Encounter</p>
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
                  {diagnoses.map((diag) => (
                    <li key={diag.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <span>
                        {diag.icd10Code ? (
                          <strong className="mr-1.5 font-mono text-xs text-teal-800">[{diag.icd10Code}]</strong>
                        ) : null}
                        <span className="font-medium text-slate-900">{diag.description}</span>
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-slate-700">
                        {diag.type}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {recentSoap.length ? (
              <Alert tone="success" className="mt-6">
                Recently saved: {recentSoap.map((item) => item.patient).join(', ')}
              </Alert>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === 'orders' ? (
        <ClinicalInvestigationOrders
          context={{
            patientId: selected.patient.id,
            patientName: `${selected.patient.firstName} ${selected.patient.lastName}`,
            encounterId: selected.id,
            encounterNo: selected.encounterNo,
            defaultClinicalIndication:
              triage?.chiefComplaint ?? selected.presentingComplaint ?? undefined,
          }}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
            void queryClient.invalidateQueries({ queryKey: ['consultation-lab-requests'] })
            void queryClient.invalidateQueries({ queryKey: ['consultation-rad-requests'] })
          }}
        />
      ) : null}

      {tab === 'results' ? (
        <ConsultationResultsPanel patientId={selected.patient.id} encounterId={selected.id} />
      ) : null}

      {tab === 'meds' ? (
        <div className="space-y-6">
          <Card className="p-5 md:p-8">
            <PageHeader
              title="5. Prescribe Medication (Multi-Line Prescription)"
              description="Select medicines from the hospital formulary catalogue (available for prescribing in AfyaSasa), specify dose, route, frequency, duration, and quantity. Catalogue inclusion does not imply PPB regulatory verification unless explicitly recorded. Prescribing does not deduct stock; Pharmacy prepares, clears with cashier, and issues."
            />
            <div className="mt-6">
              <PrescriptionForm
                patientId={selected.patient.id}
                encounterId={selected.id}
                onSuccess={() => {
                  void refetchPharmacy()
                }}
              />
            </div>
          </Card>

          <Card className="p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PageHeader
                title="Current Encounter Prescriptions & Pharmacy Progress"
                description={`Orders linked to encounter ${selected.encounterNo}`}
              />
              <Button type="button" variant="secondary" onClick={() => void refetchPharmacy()}>
                Refresh status
              </Button>
            </div>
            <div className="mt-4">
              <PrescriptionOrdersList
                orders={currentEncounterRx}
                isLoading={pharmacyLoading}
                error={pharmacyError}
                emptyMessage="No prescriptions recorded on this encounter yet."
                allowCancel
              />
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'billing' ? (
        <Card className="p-5 md:p-8">
          <PageHeader
            title="7. Billing Charges, Payments, Receipts & Exemptions"
            description="Authoritative patient financial statement from demo.charges and demo.payment_transactions."
          />
          {!canSeePayments ? (
            <Alert tone="warning" className="mt-4">
              Your role does not include billing view permissions (<code>payments:read</code>). Financial totals are not shown as zero.
            </Alert>
          ) : chargesError || paymentsError ? (
            <Alert tone="error" className="mt-4">
              {formatApiError(chargesError ?? paymentsError, 'Could not load patient billing records.')}
            </Alert>
          ) : chargesLoading || paymentsLoading ? (
            <div className="mt-4 h-36 animate-skeleton rounded-2xl" />
          ) : (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-xs uppercase text-slate-500">Total Charged</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {formatKes(charges.reduce((s, r) => s + Number(r.amountOwed), 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                  <p className="text-xs uppercase text-emerald-800">Total Paid</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-emerald-950">
                    {formatKes(charges.reduce((s, r) => s + Number(r.amountPaid), 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <p className="text-xs uppercase text-amber-800">Waived / Exempted</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-amber-950">
                    {formatKes(charges.reduce((s, r) => s + Number(r.amountWaived ?? 0), 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                  <p className="text-xs uppercase text-rose-800">Outstanding Balance</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-rose-950">
                    {formatKes(
                      charges.reduce(
                        (s, r) =>
                          s +
                          Math.max(
                            0,
                            Number(r.amountOwed) - Number(r.amountPaid) - Number(r.amountWaived ?? 0),
                          ),
                        0,
                      ),
                    )}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">Charges & Authorised Credit / Waivers</p>
                {charges.length ? (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4 text-sm">
                    {charges.map((c) => {
                      const credit = c.metadata?.creditApproval as
                        | { by?: string; reason?: string; amount?: number }
                        | undefined
                      return (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <div>
                            <p className="font-medium text-slate-900">
                              {c.serviceDescription} <span className="text-xs text-slate-500">({c.serviceLine})</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(c.createdAt).toLocaleString()}
                              {credit
                                ? ` · Credit approved (${formatKes(credit.amount ?? 0)}: ${credit.reason ?? ''})`
                                : ''}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <p className="font-semibold tabular-nums">
                              Owed {formatKes(Number(c.amountOwed))} · Paid {formatKes(Number(c.amountPaid))}
                            </p>
                            <span className="uppercase font-bold text-slate-700">{c.status}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No charges recorded for this patient.</p>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">Payments & Receipts</p>
                {payments.length ? (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4 text-sm">
                    {payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div>
                          <p className="font-medium text-slate-900">
                            {p.serviceDescription ?? p.serviceLine ?? 'Payment'} · {p.method.toUpperCase()}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(p.createdAt).toLocaleString()}
                            {p.externalReference ? ` · Receipt: ${p.externalReference}` : ''}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {formatKes(Number(p.amount ?? 0))} ({p.status})
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No payments recorded for this patient.</p>
                )}
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'history' ? (
        <div className="space-y-6">
          <Card className="p-5 md:p-8">
            <PageHeader
              title="8. Previous OPD Encounters"
              description="Historical visits separated from the active encounter."
            />
            {encountersError ? (
              <Alert tone="error" className="mt-4">
                {formatApiError(encountersError, 'Could not load previous encounters.')}
              </Alert>
            ) : encountersLoading ? (
              <div className="mt-4 h-32 animate-skeleton rounded-2xl" />
            ) : previousEncounters.length ? (
              <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {previousEncounters.map((enc) => (
                  <li key={enc.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {enc.encounterNo} · {enc.departmentName ?? 'OPD'} ({enc.visitType ?? 'visit'})
                      </p>
                      <p className="text-xs text-slate-600">
                        {new Date(enc.startedAt).toLocaleString()}
                        {enc.presentingComplaint ? ` · ${enc.presentingComplaint}` : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-slate-700">
                      {enc.status.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No previous OPD encounters on file.</p>
            )}
          </Card>

          <Card className="p-5 md:p-8">
            <PageHeader
              title="Previous Medication History"
              description="Prescriptions ordered on earlier encounters or admissions."
            />
            <div className="mt-4">
              <PrescriptionOrdersList
                orders={historicalRx}
                isLoading={pharmacyLoading}
                error={pharmacyError}
                emptyMessage="No prior medication history from previous encounters."
              />
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'referrals' ? (
        <div className="space-y-6">
          <Card className="p-5 md:p-8">
            <PageHeader title="9. Create Referral" description="Internal or external — letter stored on patient record." />
            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault()
                const form = event.currentTarget
                createReferral.mutate(form)
                void queryClient.invalidateQueries({
                  queryKey: ['patient-chart', selected.patient.id, 'referrals'],
                })
              }}
            >
              <SelectField name="type" label="Referral type" required defaultValue="internal">
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </SelectField>
              <Field name="targetDepartment" label="Department" />
              <Field name="targetFacility" label="External facility" />
              <Field name="reason" label="Reason" required />
              <TextareaField name="letter" label="Clinical summary / letter" required />
              <Button type="submit" loading={createReferral.isPending} className="min-h-12">
                Create referral
              </Button>
            </form>
          </Card>

          <Card className="p-5 md:p-8">
            <PageHeader title="Recorded Referrals" description="Existing referrals on this patient record." />
            {referralsError ? (
              <Alert tone="error" className="mt-4">
                {formatApiError(referralsError, 'Could not load referrals.')}
              </Alert>
            ) : referralsLoading ? (
              <div className="mt-4 h-24 animate-skeleton rounded-xl" />
            ) : referralsChart?.items?.length ? (
              <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {referralsChart.items.map((ref) => (
                  <li key={ref.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{ref.title}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase">
                        {ref.status ?? 'recorded'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{ref.summary}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{new Date(ref.occurredAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No referrals recorded for this patient.</p>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'disposition' ? (
        <div className="space-y-5">
          <Card className="p-5 md:p-8">
            <PageHeader
              title="9. Follow-Up & Encounter Disposition"
              description="Keep this visit on the same patient and the same encounter. Admission reuses the existing IPD admit workflow."
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                loading={completeEncounter.isPending}
                className="min-h-12"
                onClick={tryCompleteVisit}
              >
                Complete visit
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={markAwaitingResults.isPending}
                className="min-h-12"
                onClick={() => markAwaitingResults.mutate()}
              >
                Awaiting results
              </Button>
              <Button type="button" variant="secondary" className="min-h-12" onClick={() => setTab('soap')}>
                Follow-up instructions
              </Button>
              <Button type="button" variant="secondary" className="min-h-12" onClick={() => setTab('referrals')}>
                Referral
              </Button>
              <Button type="button" variant="secondary" className="min-h-12" onClick={() => setTab('disposition')}>
                Admit to IPD
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-12"
                onClick={() => onOpenSickSheets?.()}
              >
                <Printer className="h-4 w-4" />
                Sick sheet
              </Button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Follow-up uses the SOAP follow-up fields. Sick sheet opens the existing document workspace.
              Encounter status: {encounterDetail?.status ?? selected.status ?? 'unknown'}.
              {investigations.unreviewedCount
                ? ' Verified results on this visit must be marked reviewed before Complete visit.'
                : investigations.openOrders
                  ? ' Investigations are still in progress — use Awaiting results if you are waiting on lab or imaging.'
                  : ''}
            </p>
          </Card>
          <IpdAdmitPanel
            lockPatient
            lockEncounter
            initialPatient={{
              id: selected.patient.id,
              patientNo: selected.patient.patientNo,
              firstName: selected.patient.firstName,
              lastName: selected.patient.lastName,
              dateOfBirth: selected.patient.dateOfBirth,
              gender: selected.patient.gender,
              primaryPhone: selected.patient.primaryPhone,
            }}
            initialEncounterId={selected.id}
            initialEncounterNo={selected.encounterNo}
            onAdmitted={(admissionId) => onOpenIpd?.(admissionId)}
          />
        </div>
      ) : null}

      {tab === 'files' ? (
        <EncounterAttachmentsPanel encounterId={selected.id} />
      ) : null}
    </div>
  )
}
