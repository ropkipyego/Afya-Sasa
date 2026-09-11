import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer, UserPlus } from 'lucide-react'
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
import { apiRequest, getApiErrorStatus } from '../lib/api'
import { calcAge } from '../lib/patient-utils'
import { formDataFromElement } from '../lib/form-utils'
import { printPatientCard } from '../lib/print-patient-card'
import { notify } from '../lib/notify'
import { ShaEligibilityCard } from './sha/ShaEligibilityCard'

export type RegisteredPatient = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  primaryPhone: string
}

export type PatientEditRecord = RegisteredPatient & {
  middleName?: string | null
  secondaryPhone?: string | null
  email?: string | null
  bloodGroup?: string | null
  county?: string | null
  subCounty?: string | null
  nationality?: string | null
  maritalStatus?: string | null
  occupation?: string | null
  religion?: string | null
}

type DuplicateCandidate = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  gender?: string
  primaryPhone?: string
}

type DuplicateCheckResult = {
  hasPotentialDuplicate: boolean
  matchReasons?: string[]
  candidates?: DuplicateCandidate[]
  phoneMatches?: DuplicateCandidate[]
  nameDobMatches?: DuplicateCandidate[]
  identifierMatches?: { patient?: DuplicateCandidate | null }[]
  nationalIdMatches?: { patient?: DuplicateCandidate | null }[]
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

function flattenDuplicateCandidates(result: DuplicateCheckResult): DuplicateCandidate[] {
  const map = new Map<string, DuplicateCandidate>()
  const add = (patient?: DuplicateCandidate | null) => {
    if (patient?.id) map.set(patient.id, patient)
  }
  result.candidates?.forEach(add)
  result.phoneMatches?.forEach(add)
  result.nameDobMatches?.forEach(add)
  result.identifierMatches?.forEach((row) => add(row.patient))
  result.nationalIdMatches?.forEach((row) => add(row.patient))
  return Array.from(map.values())
}

function registrationError(error: unknown, fallback: string) {
  const status = getApiErrorStatus(error)
  const message = error instanceof Error ? error.message : fallback
  if (status === 400) return message
  if (status === 401) return 'Your session expired. Sign in again.'
  if (status === 403) return 'You do not have permission to register or update patients.'
  if (status === 404) return 'Patient was not found.'
  if (status === 409) return message
  if (status === 500 || status === 502 || status === 503) return fallback
  return message
}

function buildRegistrationPayload(
  formElement: HTMLFormElement,
  birthInputMode: 'dob' | 'age',
  requireGuardian: boolean,
): Record<string, unknown> {
  const form = formDataFromElement(formElement)
  const kinName = form.get('kinName')?.toString().trim()
  const allergyName = form.get('allergyName')?.toString().trim()
  const conditionName = form.get('conditionName')?.toString().trim()
  const idValue = form.get('identifierValue')?.toString().trim()
  if (!idValue) {
    throw new Error('Patient identification document is required.')
  }

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

  const firstName = String(form.get('firstName') ?? '').trim()
  const lastName = String(form.get('lastName') ?? '').trim()
  const primaryPhone = String(form.get('primaryPhone') ?? '').trim()
  if (!firstName || !lastName) {
    throw new Error('First name and last name are required.')
  }
  if (!primaryPhone) {
    throw new Error('Enter a contact phone. For a minor this is usually the guardian’s number.')
  }

  const payload: Record<string, unknown> = {
    firstName,
    middleName: form.get('middleName')?.toString().trim() || undefined,
    lastName,
    dateOfBirth,
    gender: form.get('gender'),
    primaryPhone,
    secondaryPhone: form.get('secondaryPhone') || undefined,
    email: form.get('email') || undefined,
    bloodGroup: form.get('bloodGroup') || undefined,
    county: form.get('county') || undefined,
    subCounty: form.get('subCounty') || undefined,
    nationality: form.get('nationality') || undefined,
    maritalStatus: form.get('maritalStatus') || undefined,
    occupation: form.get('occupation') || undefined,
    religion: form.get('religion') || undefined,
    identifiers: [
      {
        type: form.get('identifierType'),
        value: idValue,
        isPrimary: true,
      },
    ],
  }

  const kinRelationship = form.get('kinRelationship')?.toString().trim()
  const kinPhone = form.get('kinPhone')?.toString().trim()
  if (requireGuardian && (!kinName || !kinRelationship || !kinPhone)) {
    throw new Error('Guardian name, relationship, and phone are required for a minor.')
  }
  if (kinName) {
    if (!kinRelationship || !kinPhone) {
      throw new Error('Enter guardian relationship and phone, or clear the guardian name.')
    }
    payload.nextOfKin = [
      {
        name: kinName,
        relationship: kinRelationship,
        primaryPhone: kinPhone,
        idNumber: form.get('kinIdNumber')?.toString().trim() || undefined,
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

  return payload
}

function buildDemographicUpdatePayload(formElement: HTMLFormElement): Record<string, unknown> {
  const form = formDataFromElement(formElement)
  return {
    firstName: String(form.get('firstName') ?? '').trim(),
    middleName: String(form.get('middleName') ?? '').trim() || undefined,
    lastName: String(form.get('lastName') ?? '').trim(),
    dateOfBirth: form.get('dateOfBirth'),
    gender: form.get('gender'),
    primaryPhone: String(form.get('primaryPhone') ?? '').trim(),
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
}

export function PatientRegistrationForm({
  onViewPatient,
  onQuickCheckIn,
  editPatient,
  onEditComplete,
  onCancelEdit,
}: {
  onViewPatient?: (patientId: string) => void
  onQuickCheckIn?: (patient: RegisteredPatient) => void
  editPatient?: PatientEditRecord | null
  onEditComplete?: () => void
  onCancelEdit?: () => void
} = {}) {
  const queryClient = useQueryClient()
  const { data: catalog } = useClinicalCatalog()
  const [step, setStep] = useState(0)
  const [searchMatch, setSearchMatch] = useState<DuplicateCandidate | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [registeredPatient, setRegisteredPatient] = useState<RegisteredPatient | null>(null)
  const [printingCard, setPrintingCard] = useState(false)
  const [identifierType, setIdentifierType] = useState('national_id')
  const [birthInputMode, setBirthInputMode] = useState<'dob' | 'age'>('dob')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [ageYears, setAgeYears] = useState('')
  const estimatedAge =
    birthInputMode === 'dob' && dateOfBirth
      ? calcAge(dateOfBirth)
      : birthInputMode === 'age' && ageYears !== ''
        ? Number(ageYears)
        : Number.NaN
  const isMinor = Number.isFinite(estimatedAge) && estimatedAge >= 0 && estimatedAge < 18
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([])
  const [duplicateReasons, setDuplicateReasons] = useState<string[]>([])
  const [duplicateCheckWarning, setDuplicateCheckWarning] = useState<string | null>(null)
  const [acknowledgedDuplicates, setAcknowledgedDuplicates] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null)

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<RegisteredPatient>('/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onError: (error: Error) => {
      notify('Could not register patient', registrationError(error, 'Unable to register the patient.'), 'critical')
    },
    onSuccess: (patient) => {
      setMessage(`Registered ${patient.patientNo}. SMS queued.`)
      setRegisteredPatient(patient)
      setDuplicateCandidates([])
      setDuplicateReasons([])
      setDuplicateCheckWarning(null)
      setAcknowledgedDuplicates(false)
      setPendingPayload(null)
      void queryClient.invalidateQueries({ queryKey: ['recent-patients'] })
      emitAppNotification({
        title: 'Patient registered',
        body: `${patient.firstName} ${patient.lastName} (${patient.patientNo})`,
        severity: 'success',
      })
      setStep(0)
    },
  })

  const createAfterChecks = async (payload: Record<string, unknown>, skipDuplicateCheck: boolean) => {
    if (!skipDuplicateCheck && !acknowledgedDuplicates) {
      try {
        const result = await apiRequest<DuplicateCheckResult>('/patients/duplicates', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (result.hasPotentialDuplicate) {
          const matches = flattenDuplicateCandidates(result)
          setDuplicateCandidates(matches)
          setDuplicateReasons(result.matchReasons ?? [])
          setPendingPayload(payload)
          setDuplicateCheckWarning(null)
          return
        }
        setDuplicateCandidates([])
        setDuplicateCheckWarning(null)
      } catch (error) {
        setDuplicateCheckWarning(
          error instanceof Error
            ? `Duplicate check unavailable: ${error.message}. Review the search results, then register only if this is a new person.`
            : 'Duplicate check unavailable. Review the search results, then register only if this is a new person.',
        )
        setPendingPayload(payload)
        return
      }
    }
    mutation.mutate(payload)
  }

  const steps = ['Search registry', 'Register patient']

  const toCheckInPatient = (patient: DuplicateCandidate | RegisteredPatient): RegisteredPatient => ({
    id: patient.id,
    patientNo: patient.patientNo,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: 'dateOfBirth' in patient && patient.dateOfBirth ? patient.dateOfBirth : '',
    gender: 'gender' in patient && patient.gender ? patient.gender : 'unknown',
    primaryPhone: 'primaryPhone' in patient && patient.primaryPhone ? patient.primaryPhone : '',
  })

  if (editPatient) {
    return (
      <PatientEditForm
        patient={editPatient}
        onComplete={onEditComplete}
        onCancel={onCancelEdit}
      />
    )
  }

  if (step === 0) {
    return (
      <div className="workspace-shell animate-fade-in">
      <div className="grid gap-8 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="p-5 md:p-8">
          <PageHeader
            eyebrow="Front Office"
            title="Register a patient"
            description="Search first. Only continue if no matching patient exists."
          />
          <WorkflowSteps steps={steps} current={0} />
          <PatientSearchBrowse
            onSelect={(patient) => {
              setSearchMatch(patient)
            }}
          />
          {searchMatch ? (
            <Alert tone="warning" className="mt-4" title="Possible existing record">
              <strong>
                {searchMatch.firstName} {searchMatch.lastName}
              </strong>{' '}
              ({searchMatch.patientNo}) already exists. Do not register again.
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => onViewPatient?.(searchMatch.id)}>
                  View patient
                </Button>
                <Button
                  type="button"
                  onClick={() => onQuickCheckIn?.(toCheckInPatient(searchMatch))}
                >
                  Quick Check-In
                </Button>
                <Button type="button" variant="ghost" onClick={() => setSearchMatch(null)}>
                  Clear match
                </Button>
              </div>
            </Alert>
          ) : null}
          {message ? <Alert tone="success" className="mt-4">{message}</Alert> : null}
          {registeredPatient ? (
            <Card className="mt-4 border-teal-200 bg-teal-50 p-5">
              <p className="text-sm font-semibold text-teal-900">
                {registeredPatient.firstName} {registeredPatient.lastName} ({registeredPatient.patientNo}) is
                registered.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" onClick={() => onQuickCheckIn?.(registeredPatient)}>
                  Quick Check-In
                </Button>
                <Button type="button" variant="secondary" onClick={() => onViewPatient?.(registeredPatient.id)}>
                  View patient
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  loading={printingCard}
                  onClick={async () => {
                    setPrintingCard(true)
                    try {
                      await printPatientCard(registeredPatient.id, catalog)
                    } catch (error) {
                      notify(
                        'Print failed',
                        error instanceof Error ? error.message : 'Could not prepare patient card.',
                        'critical',
                      )
                    } finally {
                      setPrintingCard(false)
                    }
                  }}
                >
                  <Printer className="h-4 w-4" />
                  Print patient card
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setRegisteredPatient(null)
                    setMessage(null)
                  }}
                >
                  Done
                </Button>
              </div>
            </Card>
          ) : null}
          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              onClick={() => {
                if (searchMatch) {
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
        eyebrow="Front Office"
        title="New patient registration"
        description="Required fields only upfront. Expand optional sections as needed."
      />
      <WorkflowSteps steps={steps} current={1} />
      <ClinicalForm
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            if (mutation.isPending) return
            const payload = buildRegistrationPayload(event.currentTarget, birthInputMode, isMinor)
            await createAfterChecks(payload, false)
          } catch (error) {
            notify(
              'Registration incomplete',
              error instanceof Error ? error.message : 'Check required fields.',
              'critical',
            )
          }
        }}
        className="space-y-10"
      >
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
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
                      ? 'bg-white text-teal-700'
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
                      ? 'bg-white text-teal-700'
                      : 'text-slate-600 hover:bg-white/60'
                  }`}
                  onClick={() => setBirthInputMode('age')}
                  aria-pressed={birthInputMode === 'age'}
                >
                  Age in years
                </button>
              </div>
              {birthInputMode === 'dob' ? (
                <Field
                  name="dateOfBirth"
                  label="Date of birth"
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(event) => {
                    setDateOfBirth(event.target.value)
                    if (event.target.value && calcAge(event.target.value) < 18) {
                      setIdentifierType((current) =>
                        current === 'national_id' ? 'birth_certificate' : current,
                      )
                    }
                  }}
                  hint={dateOfBirth ? `Age ${calcAge(dateOfBirth)} years` : undefined}
                />
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
                  value={ageYears}
                  onChange={(event) => {
                    setAgeYears(event.target.value)
                    if (Number(event.target.value) < 18) {
                      setIdentifierType((current) =>
                        current === 'national_id' ? 'birth_certificate' : current,
                      )
                    }
                  }}
                />
              )}
              {isMinor ? (
                <p className="mt-2 text-sm font-medium text-amber-800">
                  This is a minor. The child is the patient — record the parent/guardian below, not as a second registration.
                </p>
              ) : null}
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

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="border-b border-slate-100 pb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Identification</p>
            <p className="mt-1 text-sm text-slate-500">
              SHA eligibility (sha.go.ke / Client Registry) accepts National ID, birth certificate/notification,
              Alien ID, Refugee ID, or Mandate Number — not a passport.
            </p>
          </div>
          <FormSection title="" columns={2}>
            <SelectField
              name="identifierType"
              label="Document type"
              required
              value={identifierType}
              onChange={(event) => setIdentifierType(event.target.value)}
            >
              <option value="national_id">National ID</option>
              <option value="birth_certificate">Birth certificate</option>
              <option value="birth_notification">Birth notification</option>
              <option value="alien_id">Alien ID</option>
              <option value="refugee_id">Refugee ID</option>
              <option value="client_registry">SHA Client Registry ID</option>
              <option value="sha">SHA member number (local only)</option>
              <option value="passport">Passport (not used by SHA eligibility)</option>
            </SelectField>
            <Field
              name="identifierValue"
              label={identifierFieldLabel(identifierType, catalog)}
              required
              placeholder="Enter ID / SHA number"
            />
          </FormSection>
          <ShaEligibilityCard />
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

        <section
          className={`space-y-5 rounded-2xl border p-6 ${
            isMinor ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="border-b border-slate-200/80 pb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
              {isMinor ? 'Guardian / parent' : 'Next of kin'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {isMinor
                ? 'Required. Stored on the child’s file. Do not create a second patient for the guardian.'
                : 'Optional emergency contact.'}
            </p>
          </div>
          <FormSection title="" columns={2}>
            <Field name="kinName" label={isMinor ? 'Guardian name' : 'Contact name'} required={isMinor} />
            <Field
              name="kinRelationship"
              label="Relationship"
              placeholder="Parent, guardian, spouse"
              required={isMinor}
            />
            <Field name="kinPhone" label={isMinor ? 'Guardian phone' : 'Contact phone'} required={isMinor} />
            <Field
              name="kinIdNumber"
              label={isMinor ? 'Guardian ID number' : 'Next-of-kin ID number'}
              placeholder="National ID, passport, or other ID"
              hint="Stays on this patient file."
            />
          </FormSection>
        </section>

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

        {duplicateCandidates.length ? (
          <Alert tone="warning" title="Possible duplicate — do not create another record">
            <p>
              Matches found
              {duplicateReasons.length ? ` (${duplicateReasons.join(', ')})` : ''}. Open the existing
              file unless this is a different person.
            </p>
            <ul className="mt-3 space-y-2">
              {duplicateCandidates.map((candidate) => (
                <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>
                      {candidate.firstName} {candidate.lastName}
                    </strong>{' '}
                    ({candidate.patientNo})
                    {candidate.primaryPhone ? ` · ${candidate.primaryPhone}` : ''}
                  </span>
                  <Button type="button" variant="secondary" onClick={() => onViewPatient?.(candidate.id)}>
                    Review match
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="danger"
                disabled={mutation.isPending}
                onClick={() => {
                  if (!pendingPayload) return
                  if (mutation.isPending) return
                  setAcknowledgedDuplicates(true)
                  mutation.mutate(pendingPayload)
                }}
              >
                This is a different person — register anyway
              </Button>
            </div>
          </Alert>
        ) : null}

        {duplicateCheckWarning ? (
          <Alert tone="warning" title="Duplicate check could not run">
            {duplicateCheckWarning}
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!pendingPayload) return
                  setAcknowledgedDuplicates(true)
                  mutation.mutate(pendingPayload)
                }}
              >
                Register without duplicate check
              </Button>
            </div>
          </Alert>
        ) : null}

        {mutation.error ? (
          <Alert tone="error">{registrationError(mutation.error, 'Unable to register the patient.')}</Alert>
        ) : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => setStep(0)}>
            Back to search
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={mutation.isPending || duplicateCandidates.length > 0}
          >
            {mutation.isPending ? 'Saving…' : 'Register patient'}
          </Button>
        </FormActions>
      </ClinicalForm>
    </Card>
    </div>
  )
}

function PatientEditForm({
  patient,
  onComplete,
  onCancel,
}: {
  patient: PatientEditRecord
  onComplete?: () => void
  onCancel?: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<PatientEditRecord>(`/patients/${patient.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      notify('Patient updated', 'Demographics saved. Identifiers, next of kin, and alerts were not changed.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['patient', patient.id] })
      await queryClient.invalidateQueries({ queryKey: ['patient-timeline', patient.id] })
      await queryClient.invalidateQueries({ queryKey: ['recent-patients'] })
      onComplete?.()
    },
    onError: (err: Error) =>
      setError(registrationError(err, 'Unable to save the patient details.')),
  })

  return (
    <Card className="p-5 md:p-8">
      <PageHeader
        eyebrow="Records"
        title="Edit patient"
        description="Patient number cannot be changed. Identifiers, next of kin, allergies, and chronic conditions stay on this file."
      />
      <ClinicalForm
        className="mt-6 space-y-8"
        onSubmit={(event) => {
          event.preventDefault()
          if (mutation.isPending) return
          setError(null)
          mutation.mutate(buildDemographicUpdatePayload(event.currentTarget))
        }}
      >
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Personal details</p>
          <FormSection title="" columns={2}>
            <Field name="firstName" label="First name" required defaultValue={patient.firstName} />
            <Field name="lastName" label="Last name" required defaultValue={patient.lastName} />
            <Field name="middleName" label="Middle name" defaultValue={patient.middleName ?? ''} />
            <SelectField name="gender" label="Gender" required defaultValue={patient.gender}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="intersex">Intersex</option>
              <option value="unknown">Unknown</option>
            </SelectField>
            <Field
              name="dateOfBirth"
              label="Date of birth"
              type="date"
              required
              defaultValue={patient.dateOfBirth?.slice(0, 10)}
            />
            <Field
              name="patientNo"
              label="Patient number"
              defaultValue={patient.patientNo}
              readOnly
              hint="Assigned at registration and cannot be edited."
            />
          </FormSection>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Contact information</p>
          <FormSection title="" columns={2}>
            <Field name="primaryPhone" label="Phone number" required defaultValue={patient.primaryPhone} />
            <Field name="secondaryPhone" label="Alternative phone" defaultValue={patient.secondaryPhone ?? ''} />
            <Field name="email" label="Email" type="email" defaultValue={patient.email ?? ''} />
          </FormSection>
        </section>

        <CollapsibleSection title="Optional demographics" description="Additional patient details">
          <Field name="occupation" label="Occupation" defaultValue={patient.occupation ?? ''} />
          <SelectField name="maritalStatus" label="Marital status" defaultValue={patient.maritalStatus ?? ''}>
            <option value="">Not specified</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </SelectField>
          <Field name="nationality" label="Nationality" defaultValue={patient.nationality ?? ''} />
          <Field name="county" label="County" defaultValue={patient.county ?? ''} />
          <Field name="subCounty" label="Sub county" defaultValue={patient.subCounty ?? ''} />
          <SelectField name="bloodGroup" label="Blood group" defaultValue={patient.bloodGroup ?? ''}>
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
          <Field name="religion" label="Religion" defaultValue={patient.religion ?? ''} />
        </CollapsibleSection>

        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormActions>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </FormActions>
      </ClinicalForm>
    </Card>
  )
}
