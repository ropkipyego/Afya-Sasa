import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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
import { useClinicalCatalog } from '../../hooks/useClinicalCatalog'
import { type ClinicalCatalog, doctorSelectOptions } from '../../lib/clinical-catalog'
import { formDataFromElement, submitClinicalForm } from '../../lib/form-utils'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

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

export function OpdCheckInWorkspace() {
  const { data: catalog = null } = useClinicalCatalog()
  const catalogData = catalog as ClinicalCatalog
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<CheckInPatient | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [visitDraft, setVisitDraft] = useState({
    departmentName: '',
    visitType: 'new',
    referralSource: '',
    preferredDoctor: '',
  })
  const doctorOptions = doctorSelectOptions(catalogData)

  const createEncounter = useMutation({
    mutationFn: async (formElement: HTMLFormElement) => {
      if (!selected) throw new Error('Select a patient first.')
      const form = formDataFromElement(formElement)
      return apiRequest<{ id: string }>('/opd/encounters', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selected.id,
          visitType: form.get('visitType'),
          destination: 'doctor',
          departmentName: form.get('departmentName') || undefined,
          referralSource: form.get('referralSource') || undefined,
          paymentMethod: form.get('paymentMethod') || undefined,
          receiptNumber: form.get('receiptNumber') || undefined,
        }),
      })
    },
    onSuccess: () => {
      notify('Check-in complete', 'Patient checked in and sent to triage queue.', 'success')
      setSelected(null)
      setStep(0)
      setFormError(null)
    },
    onError: (error: Error) => setFormError(error.message),
  })

  return (
    <div className="workspace-shell animate-fade-in">
      <Card className="card-hover p-5 md:p-8">
        <PageHeader
          eyebrow="Reception"
          title="OPD check-in"
          description="A calm, step-by-step workflow — identify the patient, set visit context, then check in."
        />
        <WorkflowSteps steps={steps} current={step} />

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
              <PatientContextHeader patient={selected} workflowStep="checked_in" showWorkflow />
            ) : null}
            <div className="flex justify-end">
              <Button type="button" disabled={!selected} onClick={() => setStep(1)}>
                Continue →
              </Button>
            </div>
          </div>
        ) : null}

        {step === 1 && selected ? (
          <ClinicalForm
            className="mt-8 space-y-8"
            onSubmit={(event) => {
              event.preventDefault()
              const form = formDataFromElement(event.currentTarget)
              setVisitDraft({
                departmentName: String(form.get('departmentName') ?? ''),
                visitType: String(form.get('visitType') ?? 'new'),
                referralSource: String(form.get('referralSource') ?? ''),
                preferredDoctor: String(form.get('preferredDoctor') ?? ''),
              })
              setStep(2)
            }}
          >
            <section className="space-y-4 rounded-2xl border border-slate-200 p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-teal-700">
                Clinic & visit
              </h3>
              <SelectField name="departmentName" label="Clinic" required defaultValue={visitDraft.departmentName}>
                <option value="">Select clinic</option>
                {(catalogData?.clinics ?? []).map((clinic: string) => (
                  <option key={clinic} value={clinic}>
                    {clinic}
                  </option>
                ))}
              </SelectField>
              <SelectField name="visitType" label="Visit type" required defaultValue={visitDraft.visitType}>
                {(catalogData?.visitTypes ?? []).map((item: { value: string; label: string }) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
              <SelectField name="referralSource" label="Referral source" hint="Optional">
                <option value="">Not specified</option>
                {(catalogData?.referralSources ?? []).map((item: { value: string; label: string }) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
              {doctorOptions.length ? (
                <SelectField name="preferredDoctor" label="Preferred doctor" hint="Optional">
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
                { icon: Stethoscope, label: 'Clinic', value: visitDraft.departmentName || '—' },
                { icon: CalendarCheck, label: 'Visit type', value: visitDraft.visitType },
                {
                  icon: User,
                  label: 'Doctor',
                  value: visitDraft.preferredDoctor || 'Any available',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="card-hover rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <item.icon className="mb-2 h-5 w-5 text-teal-600" />
                  <p className="text-[10px] font-bold uppercase text-slate-500">{item.label}</p>
                  <p className="mt-1 font-semibold capitalize text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Vitals and chief complaint are captured at triage — not at reception.
            </p>
            <ClinicalForm
              onSubmit={(event) =>
                submitClinicalForm(createEncounter, event, {
                  validate: () => (selected ? null : 'Select a patient.'),
                  onValidationError: setFormError,
                })
              }
            >
              <input type="hidden" name="departmentName" value={visitDraft.departmentName} />
              <input type="hidden" name="visitType" value={visitDraft.visitType} />
              <input type="hidden" name="referralSource" value={visitDraft.referralSource} />
              {formError ? <Alert tone="error">{formError}</Alert> : null}
              {createEncounter.isSuccess ? (
                <Alert tone="success">Patient checked in successfully.</Alert>
              ) : null}
              <FormActions>
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" loading={createEncounter.isPending}>
                  Confirm check-in
                </Button>
              </FormActions>
            </ClinicalForm>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
