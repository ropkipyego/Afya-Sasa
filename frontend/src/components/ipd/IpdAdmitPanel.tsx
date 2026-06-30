import { useState } from 'react'
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

export function IpdAdmitPanel({ onAdmitted }: { onAdmitted?: (admissionId: string) => void }) {
  const queryClient = useQueryClient()
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: beds = [] } = useQuery({
    queryKey: ['available-beds'],
    queryFn: () =>
      apiRequest<{ id: string; bedNo: string; ward: { name: string } }[]>(
        '/inpatient/beds/available',
      ),
  })

  const createAdmission = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      if (!selectedPatient) throw new Error('Select a patient first.')
      const form = formDataFromElement(formElement)
      return apiRequest<{ id: string }>('/inpatient/admissions', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient.id,
          encounterId: form.get('encounterId') || undefined,
          bedId: form.get('bedId'),
          reason: form.get('reason'),
          type: form.get('type'),
        }),
      })
    },
    onSuccess: async (admission) => {
      setSelectedPatient(null)
      setFormError(null)
      notify('Patient admitted', 'Bed marked occupied.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['admissions'] })
      await queryClient.invalidateQueries({ queryKey: ['available-beds'] })
      await queryClient.invalidateQueries({ queryKey: ['ipd-dashboard'] })
      onAdmitted?.(admission.id)
    },
    onError: (error: Error) => setFormError(error.message),
  })

  return (
    <Card>
      <PageHeader
        eyebrow="Inpatient"
        title="Admit patient"
        description="Search patient, assign bed, and admit without leaving IPD."
      />
      <ClinicalForm
        onSubmit={(event) =>
          submitClinicalForm(createAdmission, event, {
            validate: () => (!selectedPatient ? 'Select a patient first.' : null),
            onValidationError: setFormError,
          })
        }
      >
        <FormSection title="Patient" columns={1}>
          <PatientSearchAutocomplete
            selected={selectedPatient}
            onSelect={(patient) => setSelectedPatient(patient)}
          />
        </FormSection>
        <FormSection title="Bed & admission">
          <Field name="encounterId" label="Source encounter ID" hint="Optional — link to OPD visit" />
          <SelectField name="bedId" label="Available bed" required>
            <option value="">Select a bed</option>
            {beds.map((bed) => (
              <option key={bed.id} value={bed.id}>
                {bed.ward?.name} · {bed.bedNo}
              </option>
            ))}
          </SelectField>
          <Field name="reason" label="Reason for admission" required />
          <SelectField name="type" label="Admission type" required>
            <option value="elective">Elective</option>
            <option value="emergency">Emergency</option>
            <option value="transfer">Transfer</option>
          </SelectField>
        </FormSection>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <FormActions>
          <Button type="submit" loading={createAdmission.isPending} disabled={!selectedPatient || !beds.length}>
            Admit patient
          </Button>
        </FormActions>
      </ClinicalForm>
    </Card>
  )
}
