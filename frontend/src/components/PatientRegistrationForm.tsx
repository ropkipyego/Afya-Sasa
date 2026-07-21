import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  ClinicalForm,
  CollapsibleSection,
  Field,
  FormActions,
  FormSection,
  PageHeader,
  SelectField,
  WorkflowSteps,
} from './ui'
import { PatientSearchBrowse } from './PatientSearchAutocomplete'
import { identifierFieldLabel } from '../lib/clinical-catalog'
import { useClinicalCatalog } from '../hooks/useClinicalCatalog'
import { apiRequest } from '../lib/api'
import { formDataFromElement, submitClinicalForm } from '../lib/form-utils'

type PatientSummary = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
}

function emitAppNotification(notification: {
  title: string
  body: string
  severity?: 'info' | 'success' | 'warning' | 'critical'
}) {
  window.dispatchEvent(
    new CustomEvent('afyasasa-notification', {
      detail: { ...notification, id: crypto.randomUUID() },
    }),
  )
}

export function PatientRegistrationForm() {
  const { data: catalog } = useClinicalCatalog()
  const [step, setStep] = useState(0)
  const [duplicateFound, setDuplicateFound] = useState<PatientSummary | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [identifierType, setIdentifierType] = useState('national_id')
  const [includeId, setIncludeId] = useState(false)
  const [birthInputMode, setBirthInputMode] = useState<'dob' | 'age'>('dob')

  const mutation = useMutation({
    mutationFn: async (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const kinName = form.get('kinName')?.toString().trim()
      const allergyName = form.get('allergyName')?.toString().trim()
      const conditionName = form.get('conditionName')?.toString().trim()
      const idValue = form.get('identifierValue')?.toString().trim()
      const enteredDob = form.get('dateOfBirth')?.toString()
      const enteredAge = Number(form.get('ageYears'))
      let dateOfBirth = enteredDob

      if (birthInputMode === 'age') {
        if (!Number.isInteger(enteredAge) || enteredAge < 0 || enteredAge > 130) {
          throw new Error('Enter a valid age between 0 and 130 years.')
        }
        const estimatedDob = new Date()
        estimatedDob.setFullYear(estimatedDob.getFullYear() - enteredAge)
        dateOfBirth = estimatedDob.toISOString().slice(0, 10)
      }

      if (!dateOfBirth) {
        throw new Error('Enter the patient date of birth or age.')
      }

      const payload: Record<string, unknown> = {
        firstName: form.get('firstName'),
        middleName: form.get('middleName') || undefined,
        lastName: form.get('lastName'),
        dateOfBirth,
        gender: form.get('gender'),
        primaryPhone: form.get('primaryPhone'),
        secondaryPhone: form.get('secondaryPhone') || undefined,
        email: form.get('email') || undefined,
        bloodGroup: form.get('bloodGroup') || undefined,
        county: form.get('county') || undefined,
        subCounty: form.get('subCounty') || undefined,
        nationality: form.get('nationality') || undefined,
        maritalStatus: form.get('maritalStatus') || undefined,
        occupation: form.get('occupation') || undefined,
        religion: form.get('religion') || undefined,
      }

      if (includeId && idValue) {
        payload.identifiers = [
          {
            type: form.get('identifierType'),
            value: idValue,
            isPrimary: true,
          },
        ]
      }

      if (kinName) {
        payload.nextOfKin = [
          {
            name: kinName,
            relationship: form.get('kinRelationship'),
            primaryPhone: form.get('kinPhone'),
            idNumber: form.get('kinIdNumber') || undefined,
            isEmergencyContact: true,
          },
        ]
      }

      if (allergyName) {
        payload.allergies = [
          {
            allergen: allergyName,
            type: form.get('allergyType') || 'drug',
            reaction: form.get('allergyReaction') || 'Not specified',
            severity: form.get('allergySeverity') || 'moderate',
          },
        ]
      }

      if (conditionName) {
        payload.chronicConditions = [
          {
            name: conditionName,
            icd10Code: form.get('conditionIcd') || undefined,
            status: form.get('conditionStatus') || 'active',
          },
        ]
      }

      return apiRequest<PatientSummary>('/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: (patient) => {
      setMessage(`Registered ${patient.patientNo}. SMS queued.`)
      emitAppNotification({
        title: 'Patient registered',
        body: `${patient.firstName} ${patient.lastName} (${patient.patientNo})`,
        severity: 'success',
      })
      setStep(0)
    },
  })

  const steps = ['Search registry', 'Register patient']

  if (step === 0) {
    return (
      <div className="workspace-shell animate-fade-in">
      <div className="grid gap-8 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="p-5 md:p-8">
          <PageHeader
            eyebrow="Reception"
            title="Register a patient"
            description="Search first. Only continue if no matching patient exists."
          />
          <WorkflowSteps steps={steps} current={0} />
          <PatientSearchBrowse
            onSelect={(patient) => {
              setDuplicateFound(patient)
            }}
          />
          {duplicateFound ? (
            <Alert tone="warning" className="mt-4">
              <strong>
                {duplicateFound.firstName} {duplicateFound.lastName}
              </strong>{' '}
              ({duplicateFound.patientNo}) already exists. Do not register again.
            </Alert>
          ) : null}
          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              onClick={() => {
                if (duplicateFound) {
                  setMessage('Clear the duplicate match or open their existing record.')
                  return
                }
                setStep(1)
              }}
            >
              No match — continue registration
            </Button>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-teal-900 to-teal-800 text-white">
          <UserPlus className="mb-3 text-teal-200" />
          <h3 className="text-lg font-bold">Search-first safety</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-teal-100">
            <li>Search by name, phone, patient number, or ID.</li>
            <li>Duplicate patients cause clinical risk.</li>
            <li>Only required fields are needed to register.</li>
            <li>Medical alerts can be captured at registration.</li>
          </ul>
        </Card>
      </div>
      </div>
    )
  }

  return (
    <div className="workspace-shell animate-fade-in">
    <Card className="max-w-5xl p-5 md:p-8">
      <PageHeader
        eyebrow="Reception"
        title="New patient registration"
        description="Required fields only upfront. Expand optional sections as needed."
      />
      <WorkflowSteps steps={steps} current={1} />
      <ClinicalForm onSubmit={(event) => submitClinicalForm(mutation, event)} className="space-y-10">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-100 pb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Personal details</p>
            <p className="mt-1 text-sm text-slate-500">Required information to create a safe patient record.</p>
          </div>
          <FormSection title="" columns={2}>
            <Field name="firstName" label="First name" required />
            <Field name="lastName" label="Last name" required />
            <SelectField name="gender" label="Gender" required>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="intersex">Intersex</option>
              <option value="unknown">Unknown</option>
            </SelectField>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Birth information <span className="text-red-500">*</span>
              </span>
              <div className="mb-3 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    birthInputMode === 'dob'
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:bg-white/60'
                  }`}
                  onClick={() => setBirthInputMode('dob')}
                  aria-pressed={birthInputMode === 'dob'}
                >
                  Date of birth
                </button>
                <button
                  type="button"
                  className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    birthInputMode === 'age'
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:bg-white/60'
                  }`}
                  onClick={() => setBirthInputMode('age')}
                  aria-pressed={birthInputMode === 'age'}
                >
                  Age in years
                </button>
              </div>
              {birthInputMode === 'dob' ? (
                <Field name="dateOfBirth" label="Date of birth" type="date" required />
              ) : (
                <Field
                  name="ageYears"
                  label="Current age"
                  type="number"
                  min={0}
                  max={130}
                  step={1}
                  placeholder="e.g. 42"
                  hint="The system estimates the date of birth from today's date."
                  required
                />
              )}
            </div>
          </FormSection>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
          <div className="border-b border-slate-200 pb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Contact information</p>
            <p className="mt-1 text-sm text-slate-500">Primary phone is required. Other fields are optional.</p>
          </div>
          <FormSection title="" columns={2}>
            <Field name="primaryPhone" label="Phone number" required />
            <Field name="secondaryPhone" label="Alternative phone" hint="Optional" />
            <Field name="email" label="Email" type="email" hint="Optional" />
          </FormSection>
        </section>

        <CollapsibleSection title="Optional demographics" description="Additional patient details">
          <Field name="middleName" label="Middle name" />
          <Field name="occupation" label="Occupation" />
          <SelectField name="maritalStatus" label="Marital status">
            <option value="">Not specified</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </SelectField>
          <Field name="nationality" label="Nationality" placeholder="e.g. Kenyan" />
          <Field name="county" label="County" />
          <Field name="subCounty" label="Sub county" />
          <SelectField name="bloodGroup" label="Blood group">
            <option value="">Not known</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </SelectField>
          <Field name="religion" label="Religion" />
        </CollapsibleSection>

        <CollapsibleSection
          title="Identification"
          description="Optional at registration — can be added later"
          defaultOpen={includeId}
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeId}
              onChange={(event) => setIncludeId(event.target.checked)}
            />
            Capture ID document now
          </label>
          {includeId ? (
            <>
              <SelectField
                name="identifierType"
                label="Document type"
                value={identifierType}
                onChange={(event) => setIdentifierType(event.target.value)}
              >
                <option value="national_id">National ID</option>
                <option value="sha">SHA</option>
                <option value="passport">Passport</option>
                <option value="birth_certificate">Birth certificate</option>
                <option value="refugee_id">Alien ID</option>
              </SelectField>
              <Field name="identifierValue" label={identifierFieldLabel(identifierType, catalog)} />
            </>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection title="Next of kin" description="Optional emergency contact">
          <Field name="kinName" label="Contact name" />
          <Field name="kinRelationship" label="Relationship" placeholder="Spouse, parent, sibling" />
          <Field name="kinPhone" label="Contact phone" />
          <Field
            name="kinIdNumber"
            label="Next-of-kin ID number"
            placeholder="National ID, passport, or other ID"
            hint="Optional"
          />
        </CollapsibleSection>

        <CollapsibleSection title="Medical alerts" description="Allergies and chronic conditions — optional">
          <Field name="allergyName" label="Allergy (if any)" placeholder="e.g. Penicillin" />
          <SelectField name="allergyType" label="Allergy type">
            <option value="drug">Drug</option>
            <option value="food">Food</option>
            <option value="environmental">Environmental</option>
          </SelectField>
          <Field name="allergyReaction" label="Reaction" placeholder="Rash, anaphylaxis, etc." />
          <SelectField name="allergySeverity" label="Severity">
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="life_threatening">Life threatening</option>
          </SelectField>
          <Field name="conditionName" label="Chronic condition (if any)" placeholder="e.g. Diabetes" />
          <Field name="conditionIcd" label="ICD-10 (optional)" />
          <SelectField name="conditionStatus" label="Condition status">
            <option value="active">Active</option>
            <option value="controlled">Controlled</option>
            <option value="resolved">Resolved</option>
          </SelectField>
        </CollapsibleSection>

        {mutation.error ? <Alert tone="error">{mutation.error.message}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => setStep(0)}>
            Back to search
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Register patient
          </Button>
        </FormActions>
      </ClinicalForm>
    </Card>
    </div>
  )
}
