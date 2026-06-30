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
} from '../../ui'
import { apiRequest } from '../../../lib/api'
import { formDataFromElement, submitClinicalForm } from '../../../lib/form-utils'
import { notify } from '../../../lib/notify'
import type { ClinicalCatalog, HospitalProfile } from '../../../lib/clinical-catalog'
import { normalizeClinicalCatalog } from '../../../lib/clinical-catalog'

type SettingsResponse = {
  smsSenderName: string
  patientIdPrefix: string
  triageSystem: string
  clinicalCatalog?: Partial<ClinicalCatalog>
  tenant?: {
    name: string
    code: string
    address?: string | null
    mohFacilityCode?: string | null
    licenceNumber?: string | null
  }
}

export function HospitalProfilePanel() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiRequest<SettingsResponse>('/admin/settings'),
  })

  const catalog = normalizeClinicalCatalog(data?.clinicalCatalog)
  const profile = catalog.hospitalProfile ?? {}

  const update = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const hospitalProfile: Partial<HospitalProfile> = {
        facilityName: String(form.get('facilityName') ?? ''),
        mohFacilityCode: String(form.get('mohFacilityCode') ?? ''),
        licenceNumber: String(form.get('licenceNumber') ?? ''),
        address: String(form.get('address') ?? ''),
        contactPhone: String(form.get('contactPhone') ?? ''),
        contactEmail: String(form.get('contactEmail') ?? ''),
        primaryColor: String(form.get('primaryColor') ?? '#0d9488'),
      }
      return apiRequest('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          smsSenderName: form.get('smsSenderName'),
          patientIdPrefix: form.get('patientIdPrefix'),
          triageSystem: form.get('triageSystem'),
          clinicalCatalog: {
            ...data?.clinicalCatalog,
            hospitalProfile,
          },
        }),
      })
    },
    onSuccess: async () => {
      notify('Hospital profile saved', 'Organization settings updated.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
    },
  })

  return (
    <Card className="p-8">
      <PageHeader
        title="Hospital profile"
        description="Organization identity, facility codes, and system defaults."
      />
      <ClinicalForm
        key={data ? data.patientIdPrefix : 'loading'}
        onSubmit={(e) => submitClinicalForm(update, e, { resetOnSuccess: false })}
      >
        <FormSection title="Organization">
          <Field
            name="facilityName"
            label="Hospital name"
            defaultValue={profile.facilityName ?? data?.tenant?.name ?? ''}
            required
          />
          <Field
            name="mohFacilityCode"
            label="MOH facility code"
            defaultValue={profile.mohFacilityCode ?? data?.tenant?.mohFacilityCode ?? ''}
          />
          <Field
            name="licenceNumber"
            label="Licence number"
            defaultValue={profile.licenceNumber ?? data?.tenant?.licenceNumber ?? ''}
          />
          <Field
            name="address"
            label="Address"
            defaultValue={profile.address ?? data?.tenant?.address ?? ''}
          />
          <Field name="contactPhone" label="Contact phone" defaultValue={profile.contactPhone ?? ''} />
          <Field name="contactEmail" label="Contact email" defaultValue={profile.contactEmail ?? ''} />
          <Field
            name="primaryColor"
            label="Primary brand color"
            type="color"
            defaultValue={profile.primaryColor ?? '#0d9488'}
          />
        </FormSection>
        <FormSection title="System defaults">
          <Field name="smsSenderName" label="SMS sender name" defaultValue={data?.smsSenderName ?? ''} />
          <Field name="patientIdPrefix" label="Patient ID prefix" defaultValue={data?.patientIdPrefix ?? ''} />
          <Field name="triageSystem" label="Triage system" defaultValue={data?.triageSystem ?? ''} />
        </FormSection>
        {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
        <FormActions>
          <Button type="submit" loading={update.isPending}>Save profile</Button>
        </FormActions>
      </ClinicalForm>
    </Card>
  )
}
