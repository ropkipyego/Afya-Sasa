import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, FileText, FlaskConical, Pill, Stethoscope } from 'lucide-react'
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
import { PatientContextHeader } from './PatientContextHeader'
import { PatientTimeline, type TimelineEvent } from './PatientTimeline'
import { TriageSummaryPanel } from './VitalsFields'
import { ClinicalInvestigationOrders } from './investigations/ClinicalInvestigationOrders'
import { WorkspaceTabs } from './ui/WorkspaceTabs'
import { apiRequest } from '../lib/api'
import { notify } from '../lib/notify'
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

type DoctorTab = 'context' | 'soap' | 'orders' | 'meds' | 'referrals'

type PharmacyOrder = {
  id: string
  orderNo: string
  status: string
  orderedAt: string
  metadata?: Record<string, unknown> | null
}

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
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<DoctorTab>('soap')
  const [medication, setMedication] = useState('')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState('oral')
  const [frequency, setFrequency] = useState('')
  const [priority, setPriority] = useState('routine')

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

  const { data: pharmacyOrders = [] } = useQuery({
    queryKey: ['consultation-pharmacy', selected.patient.id, selected.id],
    queryFn: () =>
      apiRequest<PharmacyOrder[]>(
        `/clinical-orders?module=pharmacy&patientId=${selected.patient.id}&limit=20`,
      ),
    enabled: tab === 'meds',
  })

  const orderMedication = useMutation({
    mutationFn: () => {
      const name = medication.trim()
      if (!name) throw new Error('Enter a medication name.')
      return apiRequest('/clinical-orders/pharmacy', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selected.patient.id,
          encounterId: selected.id,
          medication: name,
          dose: dose.trim() || undefined,
          route: route.trim() || undefined,
          frequency: frequency.trim() || undefined,
          priority,
        }),
      })
    },
    onSuccess: async () => {
      notify('Medication ordered', `${medication.trim()} sent to pharmacy.`, 'success')
      setMedication('')
      setDose('')
      setFrequency('')
      setPriority('routine')
      await queryClient.invalidateQueries({ queryKey: ['consultation-pharmacy'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-orders'] })
    },
    onError: (error: Error) => notify('Medication order failed', error.message, 'critical'),
  })

  const workflowStep = journey?.step ?? mapEncounterStatusToWorkflow('in_consultation')

  function changeTab(next: DoctorTab) {
    if (!next) return
    setTab(next)
  }

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
        onChange={changeTab}
        tabs={[
          { id: 'context', label: 'Context', icon: <ClipboardList className="h-4 w-4" /> },
          { id: 'soap', label: 'Consultation', icon: <Stethoscope className="h-4 w-4" /> },
          { id: 'orders', label: 'Lab & imaging', icon: <FlaskConical className="h-4 w-4" /> },
          { id: 'meds', label: 'Medications', icon: <Pill className="h-4 w-4" /> },
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
              <Button type="submit" loading={createConsultation.isPending} className="min-h-12">
                Save SOAP
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={completeEncounter.isPending}
                className="min-h-12"
                onClick={() => completeEncounter.mutate()}
              >
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

      {tab === 'meds' ? (
        <Card className="p-5 md:p-8">
          <PageHeader
            title="Medications"
            description="Prescribe for this encounter — sent to the pharmacy / clinical orders feed."
          />
          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              orderMedication.mutate()
            }}
          >
            <div className="md:col-span-2">
              <Field
                name="medication"
                label="Medication"
                placeholder="e.g. Amoxicillin"
                value={medication}
                onChange={(e) => setMedication(e.target.value)}
                required
              />
            </div>
            <Field
              name="dose"
              label="Dose"
              placeholder="e.g. 500 mg"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
            />
            <SelectField
              name="route"
              label="Route"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
            >
              <option value="oral">Oral</option>
              <option value="iv">IV</option>
              <option value="im">IM</option>
              <option value="sc">SC</option>
              <option value="topical">Topical</option>
              <option value="inhalation">Inhalation</option>
              <option value="other">Other</option>
            </SelectField>
            <Field
              name="frequency"
              label="Frequency"
              placeholder="e.g. TDS × 5 days"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            />
            <SelectField
              name="priority"
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </SelectField>
            <div className="md:col-span-2">
              <Button
                type="submit"
                loading={orderMedication.isPending}
                disabled={!medication.trim()}
                className="min-h-12"
              >
                Order medication
              </Button>
            </div>
          </form>

          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-800">Recent pharmacy orders for this patient</p>
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {pharmacyOrders.map((order) => (
                <li key={order.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{order.orderNo}</p>
                      <p className="text-slate-600">
                        {String(order.metadata?.medication ?? 'Medication')}
                        {order.metadata?.dose ? ` · ${String(order.metadata.dose)}` : ''}
                        {order.metadata?.route ? ` · ${String(order.metadata.route)}` : ''}
                        {order.metadata?.frequency ? ` · ${String(order.metadata.frequency)}` : ''}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(order.orderedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">
                      {order.status}
                    </span>
                  </div>
                </li>
              ))}
              {!pharmacyOrders.length ? (
                <p className="py-6 text-center text-sm text-slate-500">No pharmacy orders yet.</p>
              ) : null}
            </ul>
          </div>
        </Card>
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
      ) : null}
    </div>
  )
}
