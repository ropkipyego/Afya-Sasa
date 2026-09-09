import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
} from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { formDataFromElement, submitClinicalForm } from '../../lib/form-utils'
import { notify } from '../../lib/notify'

type AvailableBed = {
  id: string
  bedNo: string
  status?: string
  ward: { id: string; name: string }
}

type Draft = {
  encounterId?: string
  bedId: string
  reason: string
  type: string
}

export function IpdAdmitPanel({
  onAdmitted,
  initialPatient,
  initialEncounterId,
  initialEncounterNo,
  initialBedId,
  lockPatient = false,
  lockEncounter = false,
}: {
  onAdmitted?: (admissionId: string) => void
  initialPatient?: PatientSearchItem | null
  initialEncounterId?: string
  initialEncounterNo?: string
  initialBedId?: string
  lockPatient?: boolean
  lockEncounter?: boolean
}) {
  const queryClient = useQueryClient()
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(
    initialPatient ?? null,
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => {
    if (initialPatient) setSelectedPatient(initialPatient)
  }, [initialPatient])

  const {
    data: beds = [],
    refetch: refetchBeds,
    isFetching: bedsRefreshing,
  } = useQuery({
    queryKey: ['available-beds'],
    queryFn: () => apiRequest<AvailableBed[]>('/inpatient/beds/available'),
  })

  const selectableBeds = useMemo(
    () => beds.filter((bed) => !bed.status || bed.status === 'available'),
    [beds],
  )

  const createAdmission = useMutation({
    mutationFn: (payload: Draft & { patientId: string }) =>
      apiRequest<{ id: string }>('/inpatient/admissions', {
        method: 'POST',
        body: JSON.stringify({
          patientId: payload.patientId,
          encounterId: payload.encounterId || undefined,
          bedId: payload.bedId,
          reason: payload.reason,
          type: payload.type,
        }),
      }),
    onSuccess: async (admission) => {
      setSelectedPatient(lockPatient ? selectedPatient : null)
      setFormError(null)
      setDraft(null)
      notify('Patient admitted', 'Bed marked occupied. IPD workspace is available.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['admissions'] })
      await queryClient.invalidateQueries({ queryKey: ['available-beds'] })
      await queryClient.invalidateQueries({ queryKey: ['ipd-dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['ward-census'] })
      await queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
      onAdmitted?.(admission.id)
    },
    onError: async (error: Error) => {
      setFormError(error.message)
      await refetchBeds()
    },
  })

  function captureDraft(formElement: HTMLFormElement) {
    if (!selectedPatient) throw new Error('Select a patient first.')
    const form = formDataFromElement(formElement)
    const bedId = String(form.get('bedId') || '')
    const reason = String(form.get('reason') || '').trim()
    const type = String(form.get('type') || '')
    const encounterId = String(form.get('encounterId') || initialEncounterId || '').trim()
    if (!bedId) throw new Error('Select an available bed.')
    if (!reason) throw new Error('Enter an admission reason.')
    if (!type) throw new Error('Select an admission type.')
    const bed = selectableBeds.find((item) => item.id === bedId)
    if (!bed) throw new Error('That bed is not available. Refresh and choose another bed.')
    setFormError(null)
    setDraft({
      encounterId: encounterId || undefined,
      bedId,
      reason,
      type,
    })
  }

  if (draft && selectedPatient) {
    const bed = selectableBeds.find((item) => item.id === draft.bedId)
    return (
      <Card>
        <PageHeader
          eyebrow="Inpatient"
          title="Confirm admission"
          description="Review the summary, then confirm. The same patient and encounter are used — no duplicate record is created."
        />
        <dl className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Patient</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">MRN</dt>
            <dd className="mt-1 font-semibold text-slate-900">{selectedPatient.patientNo}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Current encounter</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {initialEncounterNo || draft.encounterId || 'Not linked'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Admission reason</dt>
            <dd className="mt-1 font-semibold text-slate-900">{draft.reason}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Ward</dt>
            <dd className="mt-1 font-semibold text-slate-900">{bed?.ward?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Bed</dt>
            <dd className="mt-1 font-semibold text-slate-900">{bed?.bedNo ?? draft.bedId}</dd>
          </div>
        </dl>
        {formError ? <Alert tone="error" className="mt-4">{formError}</Alert> : null}
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraft(null)
              setFormError(null)
            }}
          >
            Back to edit
          </Button>
          <Button
            type="button"
            loading={createAdmission.isPending}
            disabled={!bed}
            onClick={() =>
              createAdmission.mutate({
                ...draft,
                patientId: selectedPatient.id,
              })
            }
          >
            Confirm admission
          </Button>
        </FormActions>
      </Card>
    )
  }

  return (
    <Card>
      <PageHeader
        eyebrow="Inpatient"
        title="Admit patient"
        description="Search patient, assign an available bed, and admit without leaving IPD."
      />
      <ClinicalForm
        onSubmit={(event) =>
          submitClinicalForm(
            {
              mutate: (form) => {
                try {
                  captureDraft(form)
                } catch (error) {
                  setFormError(error instanceof Error ? error.message : 'Unable to review admission.')
                }
              },
              isPending: false,
            },
            event,
            {
              resetOnSuccess: false,
              validate: () => (!selectedPatient ? 'Select a patient first.' : null),
              onValidationError: setFormError,
            },
          )
        }
      >
        <FormSection title="Patient" columns={1}>
          {lockPatient && selectedPatient ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </p>
              <p className="mt-1 text-xs text-slate-500">MRN {selectedPatient.patientNo}</p>
            </div>
          ) : (
            <PatientSearchAutocomplete
              selected={selectedPatient}
              onSelect={(patient) => setSelectedPatient(patient)}
            />
          )}
        </FormSection>
        <FormSection title="Bed & admission">
          {lockEncounter ? (
            <>
              <input type="hidden" name="encounterId" value={initialEncounterId ?? ''} />
              <Field
                name="encounterDisplay"
                label="Current encounter"
                value={initialEncounterNo || initialEncounterId || ''}
                readOnly
              />
            </>
          ) : (
            <Field
              name="encounterId"
              label="Source encounter ID"
              hint="Optional — link to the current OPD or ED visit"
              defaultValue={initialEncounterId}
            />
          )}
          <SelectField name="bedId" label="Available bed" required defaultValue={initialBedId}>
            <option value="">Select a bed</option>
            {selectableBeds.map((bed) => (
              <option key={bed.id} value={bed.id}>
                {bed.ward?.name} · {bed.bedNo}
              </option>
            ))}
          </SelectField>
          <Field name="reason" label="Reason for admission" required />
          <SelectField name="type" label="Admission type" required defaultValue="elective">
            <option value="elective">Elective</option>
            <option value="emergency">Emergency</option>
            <option value="transfer">Transfer</option>
          </SelectField>
        </FormSection>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        {!selectableBeds.length ? (
          <Alert tone="warning">No available beds. Occupied, reserved, cleaning, and maintenance beds cannot be selected.</Alert>
        ) : null}
        <FormActions>
          <Button type="button" variant="secondary" loading={bedsRefreshing} onClick={() => refetchBeds()}>
            Refresh beds
          </Button>
          <Button type="submit" disabled={!selectedPatient || !selectableBeds.length}>
            Review admission
          </Button>
        </FormActions>
      </ClinicalForm>
    </Card>
  )
}
