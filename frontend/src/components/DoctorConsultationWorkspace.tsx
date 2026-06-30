import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, FileText, FlaskConical, Stethoscope } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  ClinicalForm,
  Field,
  FormActions,
  FormSection,
  PageHeader,
  TextareaField,
} from './ui'
import { PatientContextHeader } from './PatientContextHeader'
import { PatientTimeline, type TimelineEvent } from './PatientTimeline'
import { TriageSummaryPanel } from './VitalsFields'
import { ClinicalInvestigationOrders } from './investigations/ClinicalInvestigationOrders'
import { WorkspaceTabs } from './ui/WorkspaceTabs'
import { apiRequest } from '../lib/api'
import type { WorkflowStep } from '../lib/workflow-status'
import { mapEncounterStatusToWorkflow } from '../lib/workflow-status'

export type ConsultationPatient = {
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

export type ConsultationEncounter = {
  id: string
  encounterNo: string
  presentingComplaint?: string
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

type DoctorTab = 'context' | 'soap' | 'orders' | 'referrals'

export function DoctorConsultationWorkspace({
  selected,
  createConsultation,
  addDiagnosis,
  completeEncounter,
  createReferral,
  recentSoap,
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
}) {
  const [tab, setTab] = useState<DoctorTab>('soap')

  const { data: timeline } = useQuery({
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

  const workflowStep = journey?.step ?? mapEncounterStatusToWorkflow('in_consultation')

  return (
    <div className="workspace-shell">
      <PatientContextHeader
        patient={selected.patient}
        workflowStep={workflowStep}
        pregnancyAlert={journey?.pregnancyAlert}
        criticalLabAlert={journey?.criticalLabAlert}
      />

      <WorkspaceTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'context', label: 'Context', icon: <ClipboardList className="h-4 w-4" /> },
          { id: 'soap', label: 'Consultation', icon: <Stethoscope className="h-4 w-4" /> },
          { id: 'orders', label: 'Investigations', icon: <FlaskConical className="h-4 w-4" /> },
          { id: 'referrals', label: 'Referrals', icon: <FileText className="h-4 w-4" /> },
        ]}
      />

      {tab === 'context' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {selected.triage ? <TriageSummaryPanel triage={selected.triage} /> : null}
          <PatientTimeline
            events={timeline?.events ?? []}
            title="Patient timeline"
            description="Lab, visits, referrals — full journey."
          />
        </div>
      ) : null}

      {tab === 'soap' ? (
        <Card className="p-5 md:p-8">
          <PageHeader title="SOAP consultation" description={`Encounter ${selected.encounterNo}`} />
          <ClinicalForm
            onSubmit={(event) => {
              event.preventDefault()
              createConsultation.mutate(event.currentTarget)
            }}
          >
            <FormSection title="Subjective & objective" columns={1}>
              <TextareaField name="subjective" label="Subjective" placeholder="History, symptoms, HPI" required />
              <TextareaField name="objective" label="Objective" placeholder="Exam findings" required />
            </FormSection>
            <FormSection title="Assessment & plan" columns={1}>
              <TextareaField name="assessment" label="Assessment" required />
              <TextareaField name="plan" label="Plan" required />
              <Field name="followUpDate" label="Follow-up date" type="date" />
              <Field name="followUpInstructions" label="Follow-up instructions" />
            </FormSection>
            <FormActions>
              <Button type="submit" loading={createConsultation.isPending}>Save SOAP</Button>
              <Button type="button" variant="secondary" loading={completeEncounter.isPending} onClick={() => completeEncounter.mutate()}>
                Complete visit
              </Button>
            </FormActions>
          </ClinicalForm>

          <form
            className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              addDiagnosis.mutate(event.currentTarget)
              event.currentTarget.reset()
            }}
          >
            <p className="md:col-span-2 text-sm font-bold text-slate-800">Add diagnosis</p>
            <Field name="icd10Code" label="ICD-10 code" />
            <Field name="description" label="Diagnosis" required />
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Type</label>
              <select name="type" className="input" required>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="differential">Differential</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" loading={addDiagnosis.isPending}>Add diagnosis</Button>
            </div>
          </form>

          {recentSoap.length ? (
            <Alert tone="success" className="mt-6">
              Recently saved: {recentSoap.map((item) => item.patient).join(', ')}
            </Alert>
          ) : null}
        </Card>
      ) : null}

      {tab === 'orders' ? (
        <ClinicalInvestigationOrders
          context={{
            patientId: selected.patient.id,
            patientName: `${selected.patient.firstName} ${selected.patient.lastName}`,
            encounterId: selected.id,
            encounterNo: selected.encounterNo,
            defaultClinicalIndication:
              selected.triage?.chiefComplaint ?? selected.presentingComplaint ?? undefined,
          }}
        />
      ) : null}

      {tab === 'referrals' ? (
        <Card className="p-5 md:p-8">
          <PageHeader title="Referral" description="Internal or external — letter stored on patient record." />
          <form
            className="mt-6 space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              createReferral.mutate(event.currentTarget)
              event.currentTarget.reset()
            }}
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Referral type</label>
              <select name="type" className="input" required>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </div>
            <Field name="targetDepartment" label="Department" />
            <Field name="targetFacility" label="External facility" />
            <Field name="reason" label="Reason" required />
            <TextareaField name="letter" label="Clinical summary / letter" required />
            <Button type="submit" loading={createReferral.isPending}>Create referral</Button>
          </form>
        </Card>
      ) : null}
    </div>
  )
}
