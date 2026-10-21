import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Stethoscope, User } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  ClinicalForm,
  CollapsibleSection,
  Field,
  FormActions,
  PageHeader,
  SelectField,
  WorkflowSteps,
} from '../ui'
import { PatientSearchAutocomplete } from '../PatientSearchAutocomplete'
import { PatientContextHeader } from '../PatientContextHeader'
import { RecentPatientsPanel, type RecentPatient } from '../patients/RecentPatientsPanel'
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import {
  type ClinicalCatalog,
  clinicConsultationFee,
  doctorSelectOptionsForClinic,
  formatConfiguredPrice,
} from '../../lib/clinical-catalog'
import { formDataFromElement, submitClinicalForm } from '../../lib/form-utils'
import { apiRequest, getApiErrorStatus } from '../../lib/api'
import { notify } from '../../lib/notify'
import { packReferringDetails } from '../../lib/referring-details'
import { ShaEligibilityCard } from '../sha/ShaEligibilityCard'

export type CheckInPatient = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  primaryPhone: string
}

const steps = ['Find patient', 'Visit details', 'Confirm check-in']

export function OpdCheckInWorkspace({
  initialPatient = null,
  onInitialPatientConsumed,
  onViewPatient,
  onOpenTriage,
}: {
  initialPatient?: CheckInPatient | null
  onInitialPatientConsumed?: () => void
  onViewPatient?: (patientId: string) => void
  onOpenTriage?: () => void
} = {}) {
  const queryClient = useQueryClient()
  const { data: catalog = null } = useClinicalCatalog()
  const catalogData = catalog as ClinicalCatalog
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<CheckInPatient | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<{
    patient: CheckInPatient
    encounterId: string
    queueToken?: string
    encounterNo?: string
  } | null>(null)
  const [visitDraft, setVisitDraft] = useState({
    clinicName: '',
    visitType: 'new',
    referralSource: '',
    referringFacility: '',
    referringDoctorName: '',
    referringDoctorPhone: '',
    referringDoctorNumber: '',
    imagingService: '',
    preferredDoctorId: '',
    preferredDoctorName: '',
  })
  const isDiagnosticVisit = ['laboratory_only', 'radiology_only', 'diagnostic'].includes(
    visitDraft.visitType,
  )
  const needsImaging = ['radiology_only', 'diagnostic'].includes(visitDraft.visitType)
  const doctorOptions = doctorSelectOptionsForClinic(catalogData, visitDraft.clinicName)
  const consultationFee = clinicConsultationFee(catalogData, visitDraft.clinicName)

  useEffect(() => {
    if (!initialPatient?.id) return
    setSelected(initialPatient)
    setStep(1)
    setCompleted(null)
    onInitialPatientConsumed?.()
  }, [initialPatient?.id])

  const selectForCheckIn = (patient: CheckInPatient) => {
    setSelected(patient)
    setStep(1)
    setFormError(null)
  }

  const createEncounter = useMutation({
    mutationFn: async (formElement: HTMLFormElement) => {
      if (!selected) throw new Error('Select a patient first.')
      const form = formDataFromElement(formElement)
      return apiRequest<{ id: string; encounterNo?: string; queueToken?: string }>('/opd/encounters', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selected.id,
          visitType: form.get('visitType'),
          clinicName: form.get('clinicName') || undefined,
          departmentName: form.get('clinicName') || undefined,
          referralSource: form.get('referralSource') || undefined,
          referralReason:
            packReferringDetails({
              facility: String(form.get('referringFacility') ?? ''),
              doctorName: String(form.get('referringDoctorName') ?? ''),
              doctorPhone: String(form.get('referringDoctorPhone') ?? ''),
              doctorNumber: String(form.get('referringDoctorNumber') ?? ''),
            }) || undefined,
          presentingComplaint: form.get('imagingService') || undefined,
          paymentMethod: form.get('paymentMethod') || undefined,
          receiptNumber: form.get('receiptNumber') || undefined,
          attendingDoctorId: form.get('attendingDoctorId') || undefined,
        }),
      })
    },
    onSuccess: (encounter) => {
      if (selected) {
        setCompleted({
          patient: selected,
          encounterId: encounter.id,
          queueToken: encounter.queueToken,
          encounterNo: encounter.encounterNo,
        })
      }
      notify(
        'Check-in complete',
        encounter.queueToken
          ? `Queue ${encounter.queueToken}. Lab/CT check-ins appear on Lab Queue and Imaging Queue, not on the doctor queue.`
          : 'Patient checked in.',
        'success',
      )
      setSelected(null)
      setStep(0)
      setFormError(null)
      void queryClient.invalidateQueries({ queryKey: ['recent-patients-encounters'] })
      void queryClient.invalidateQueries({ queryKey: ['triage-queue'] })
    },
    onError: (error: Error) => {
      const status = getApiErrorStatus(error)
      if (status === 401) {
        setFormError('Your session expired. Sign in again.')
        return
      }
      if (status === 403) {
        setFormError('You do not have permission to check in patients.')
        return
      }
      if (status === 404) {
        setFormError('Patient was not found. Search again before checking in.')
        return
      }
      setFormError(error.message)
    },
  })

  return (
    <div className="workspace-shell animate-fade-in">
      <Card className="card-hover p-5 md:p-8">
        <PageHeader
          eyebrow="Front Office"
          title="OPD check-in"
          description="A calm, step-by-step workflow — identify the patient, set visit context, then check in."
        />
        <WorkflowSteps steps={steps} current={step} />

        {completed ? (
          <Alert tone="success" className="mt-6" title="Check-in complete">
            {completed.patient.firstName} {completed.patient.lastName} ({completed.patient.patientNo})
            {completed.queueToken ? ` — queue ${completed.queueToken}` : ''} is on the triage queue.
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => onOpenTriage?.()}>
                Open Triage
              </Button>
              <Button type="button" variant="secondary" onClick={() => onViewPatient?.(completed.patient.id)}>
                View patient
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCompleted(null)}>
                Dismiss
              </Button>
            </div>
          </Alert>
        ) : null}

        {step === 0 ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <User className="h-4 w-4 text-teal-600" />
                Patient
              </div>
              <PatientSearchAutocomplete
                selected={selected}
                onSelect={(patient) => setSelected(patient as CheckInPatient | null)}
              />
            </div>
            {selected ? (
              <>
                <PatientContextHeader patient={selected} workflowStep="checked_in" showWorkflow />
                <ShaEligibilityCard patientId={selected.id} />
              </>
            ) : null}
            <div className="flex justify-end">
              <Button type="button" disabled={!selected} onClick={() => setStep(1)}>
                Continue →
              </Button>
            </div>
            <RecentPatientsPanel
              onView={(patient) => onViewPatient?.(patient.id)}
              onQuickCheckIn={(patient: RecentPatient) =>
                selectForCheckIn({
                  id: patient.id,
                  patientNo: patient.patientNo,
                  firstName: patient.firstName,
                  lastName: patient.lastName,
                  dateOfBirth: patient.dateOfBirth,
                  gender: patient.gender,
                  primaryPhone: patient.primaryPhone,
                })
              }
            />
          </div>
        ) : null}

        {step === 1 && selected ? (
          <ClinicalForm
            className="mt-8 space-y-8"
            onSubmit={(event) => {
              event.preventDefault()
              const form = formDataFromElement(event.currentTarget)
              const doctorId = String(form.get('preferredDoctor') ?? '')
              const doctorName =
                doctorOptions.find((doctor) => doctor.value === doctorId)?.label ?? ''
              setVisitDraft({
                clinicName: String(form.get('clinicName') ?? ''),
                visitType: String(form.get('visitType') ?? 'new'),
                referralSource: String(form.get('referralSource') ?? ''),
                referringFacility: String(form.get('referringFacility') ?? ''),
                referringDoctorName: String(form.get('referringDoctorName') ?? ''),
                referringDoctorPhone: String(form.get('referringDoctorPhone') ?? ''),
                referringDoctorNumber: String(form.get('referringDoctorNumber') ?? ''),
                imagingService: String(form.get('imagingService') ?? ''),
                preferredDoctorId: doctorId,
                preferredDoctorName: doctorName,
              })
              setStep(2)
            }}
          >
            <section className="space-y-4 rounded-2xl border border-slate-200 p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-teal-700">
                Clinic & visit
              </h3>
              <SelectField
                name="clinicName"
                label="Clinic"
                required
                value={visitDraft.clinicName}
                onChange={(e) =>
                  setVisitDraft((current) => ({
                    ...current,
                    clinicName: e.target.value,
                    preferredDoctorId: '',
                    preferredDoctorName: '',
                  }))
                }
              >
                <option value="">Select clinic</option>
                {(catalogData?.clinics ?? []).map((clinic: string) => (
                  <option key={clinic} value={clinic}>
                    {clinic} — {formatConfiguredPrice(clinicConsultationFee(catalogData, clinic)) ?? 'Unpriced'}
                  </option>
                ))}
              </SelectField>
              {visitDraft.clinicName && !isDiagnosticVisit ? (
                <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                  Consultation fee for <strong>{visitDraft.clinicName}</strong> is{' '}
                  <strong>{formatConfiguredPrice(consultationFee) ?? 'Unpriced'}</strong>
                  {consultationFee > 0
                    ? '. Cashier must collect this mapped amount — it is not typed from memory.'
                    : '. No hospital tariff is configured for this clinic. Do not collect KSh 0.'}
                </p>
              ) : null}
              {isDiagnosticVisit ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                  Diagnostic-only visits do not add an OPD consultation charge. The patient is sent to the
                  laboratory and/or imaging queue, not the doctor queue.
                </p>
              ) : null}
              <SelectField
                name="visitType"
                label="Visit type"
                required
                value={visitDraft.visitType}
                onChange={(e) => setVisitDraft((current) => ({ ...current, visitType: e.target.value }))}
              >
                {(catalogData?.visitTypes ?? []).map((item: { value: string; label: string }) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                name="referralSource"
                label="Referral source"
                hint="Optional"
                value={visitDraft.referralSource}
                onChange={(e) => setVisitDraft((current) => ({ ...current, referralSource: e.target.value }))}
              >
                <option value="">Not specified</option>
                {(catalogData?.referralSources ?? []).map((item: { value: string; label: string }) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
              {visitDraft.referralSource === 'facility' || visitDraft.visitType === 'referral' || isDiagnosticVisit ? (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <Field
                    name="referringFacility"
                    label="Referring facility"
                    hint="Hospital or clinic that sent this patient."
                    value={visitDraft.referringFacility}
                    onChange={(e) =>
                      setVisitDraft((current) => ({ ...current, referringFacility: e.target.value }))
                    }
                    placeholder="e.g. Kitale County Hospital"
                  />
                  <Field
                    name="referringDoctorName"
                    label="Referring doctor"
                    value={visitDraft.referringDoctorName}
                    onChange={(e) =>
                      setVisitDraft((current) => ({ ...current, referringDoctorName: e.target.value }))
                    }
                    placeholder="Full name"
                  />
                  <Field
                    name="referringDoctorPhone"
                    label="Referring doctor phone"
                    value={visitDraft.referringDoctorPhone}
                    onChange={(e) =>
                      setVisitDraft((current) => ({ ...current, referringDoctorPhone: e.target.value }))
                    }
                    placeholder="e.g. 0712 345 678"
                  />
                  <Field
                    name="referringDoctorNumber"
                    label="Referring doctor number"
                    hint="KMPDC / licence / registration number."
                    value={visitDraft.referringDoctorNumber}
                    onChange={(e) =>
                      setVisitDraft((current) => ({ ...current, referringDoctorNumber: e.target.value }))
                    }
                    placeholder="e.g. KMPDC/12345"
                  />
                </div>
              ) : null}
              {needsImaging ? (
                <SelectField
                  name="imagingService"
                  label="Imaging requested"
                  hint="Shown on the imaging arrivals list. Staff still create the formal CT/X-ray request."
                  value={visitDraft.imagingService}
                  onChange={(e) =>
                    setVisitDraft((current) => ({ ...current, imagingService: e.target.value }))
                  }
                >
                  <option value="">Select imaging…</option>
                  <option value="CT Scan">CT Scan</option>
                  <option value="X-Ray">X-Ray</option>
                  <option value="Ultrasound">Ultrasound</option>
                  <option value="MRI">MRI</option>
                  <option value="Other imaging">Other imaging</option>
                </SelectField>
              ) : null}
              {visitDraft.clinicName && !doctorOptions.length ? (
                <p className="text-sm text-amber-800">
                  No doctors are assigned to this clinic yet. Assign them under Hospital Control Center →
                  Departments & clinics. Check-in can continue without a preferred doctor.
                </p>
              ) : null}
              {doctorOptions.length ? (
                <SelectField
                  name="preferredDoctor"
                  label="Preferred doctor"
                  hint="Optional"
                  defaultValue={visitDraft.preferredDoctorId}
                >
                  <option value="">Any available</option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.value} value={doctor.value}>
                      {doctor.label}
                    </option>
                  ))}
                </SelectField>
              ) : null}
            </section>

            <CollapsibleSection title="Payment reference" description="Optional">
              <SelectField name="paymentMethod" label="Payment method">
                <option value="">Not captured</option>
                {(catalogData?.paymentMethods ?? []).map((method: { value: string; label: string }) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </SelectField>
              <Field name="receiptNumber" label="Receipt / reference number" />
            </CollapsibleSection>

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button type="submit">Review check-in →</Button>
            </div>
          </ClinicalForm>
        ) : null}

        {step === 2 && selected ? (
          <div className="mt-8 space-y-6">
            <PatientContextHeader patient={selected} workflowStep="checked_in" showWorkflow />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Stethoscope, label: 'Clinic', value: visitDraft.clinicName || '—' },
                {
                  icon: CalendarCheck,
                  label: 'Consultation fee',
                  value: isDiagnosticVisit
                    ? 'Not charged for diagnostic-only visits'
                    : visitDraft.clinicName
                      ? formatConfiguredPrice(consultationFee) ?? 'Unpriced'
                      : '—',
                },
                {
                  icon: User,
                  label: 'Doctor',
                  value: isDiagnosticVisit
                    ? 'Not sent to doctor queue'
                    : visitDraft.preferredDoctorName || 'Any available',
                },
                {
                  icon: User,
                  label: 'Referring facility',
                  value: visitDraft.referringFacility || visitDraft.referralSource || '—',
                },
                {
                  icon: User,
                  label: 'Referring doctor',
                  value: [
                    visitDraft.referringDoctorName,
                    visitDraft.referringDoctorPhone,
                    visitDraft.referringDoctorNumber,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—',
                },
                {
                  icon: Stethoscope,
                  label: 'Imaging',
                  value: visitDraft.imagingService || (isDiagnosticVisit ? 'See visit type' : '—'),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="card-hover rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <item.icon className="mb-2 h-5 w-5 text-teal-600" />
                  <p className="text-[10px] font-bold uppercase text-slate-500">{item.label}</p>
                  <p className="mt-1 font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Vitals and chief complaint are captured at triage — not at reception.
            </p>
            <ClinicalForm
              onSubmit={(event) => {
                if (createEncounter.isPending) {
                  event.preventDefault()
                  return
                }
                submitClinicalForm(createEncounter, event, {
                  resetOnSuccess: false,
                  validate: () => (selected ? null : 'Select a patient.'),
                  onValidationError: setFormError,
                })
              }}
            >
              <input type="hidden" name="clinicName" value={visitDraft.clinicName} />
              <input type="hidden" name="visitType" value={visitDraft.visitType} />
              <input type="hidden" name="referralSource" value={visitDraft.referralSource} />
              <input type="hidden" name="referringFacility" value={visitDraft.referringFacility} />
              <input type="hidden" name="referringDoctorName" value={visitDraft.referringDoctorName} />
              <input type="hidden" name="referringDoctorPhone" value={visitDraft.referringDoctorPhone} />
              <input type="hidden" name="referringDoctorNumber" value={visitDraft.referringDoctorNumber} />
              <input type="hidden" name="imagingService" value={visitDraft.imagingService} />
              <input type="hidden" name="attendingDoctorId" value={visitDraft.preferredDoctorId} />
              {formError ? <Alert tone="error">{formError}</Alert> : null}
              {createEncounter.isSuccess ? (
                <Alert tone="success">Patient checked in successfully.</Alert>
              ) : null}
              <FormActions>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={createEncounter.isPending}
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button type="submit" loading={createEncounter.isPending} disabled={createEncounter.isPending}>
                  {createEncounter.isPending ? 'Checking in…' : 'Confirm check-in'}
                </Button>
              </FormActions>
            </ClinicalForm>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
