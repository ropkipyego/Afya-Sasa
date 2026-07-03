import { useMutation } from '@tanstack/react-query'
import { formDataFromElement, submitClinicalForm } from '../../../lib/form-utils'
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
import { notify } from '../../../lib/notify'
import { useHospitalConfiguration } from '../../../hooks/useHospitalConfiguration'
import type { HospitalProfile } from '../../../lib/clinical-catalog'
import { CONFIG_DEPENDENCY_HINTS } from '../../../lib/hospital-configuration'

export function HospitalProfilePanel() {
  const { settings, catalog, saveSettings } = useHospitalConfiguration()
  const profile = catalog.hospitalProfile ?? {}

  const update = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const hospitalProfile: Partial<HospitalProfile> = {
        facilityName: String(form.get('facilityName') ?? ''),
        shortName: String(form.get('shortName') ?? ''),
        mohFacilityCode: String(form.get('mohFacilityCode') ?? ''),
        licenceNumber: String(form.get('licenceNumber') ?? ''),
        registrationNumber: String(form.get('registrationNumber') ?? ''),
        facilityLevel: String(form.get('facilityLevel') ?? ''),
        ownership: String(form.get('ownership') ?? ''),
        hospitalType: String(form.get('hospitalType') ?? ''),
        county: String(form.get('county') ?? ''),
        subCounty: String(form.get('subCounty') ?? ''),
        address: String(form.get('address') ?? ''),
        physicalAddress: String(form.get('physicalAddress') ?? ''),
        postalAddress: String(form.get('postalAddress') ?? ''),
        contactPhone: String(form.get('contactPhone') ?? ''),
        contactEmail: String(form.get('contactEmail') ?? ''),
        website: String(form.get('website') ?? ''),
        kraPin: String(form.get('kraPin') ?? ''),
        timeZone: String(form.get('timeZone') ?? 'Africa/Nairobi'),
        language: String(form.get('language') ?? 'en'),
        currency: String(form.get('currency') ?? 'KES'),
        primaryColor: String(form.get('primaryColor') ?? '#0d9488'),
        accentColor: String(form.get('accentColor') ?? '#0f766e'),
        logoUrl: String(form.get('logoUrl') ?? ''),
        faviconUrl: String(form.get('faviconUrl') ?? ''),
        stampUrl: String(form.get('stampUrl') ?? ''),
        sealUrl: String(form.get('sealUrl') ?? ''),
        footerText: String(form.get('footerText') ?? ''),
        tagline: String(form.get('tagline') ?? ''),
        smsSignature: String(form.get('smsSignature') ?? ''),
      }
      return saveSettings.mutateAsync({
        smsSenderName: String(form.get('smsSenderName') ?? ''),
        patientIdPrefix: String(form.get('patientIdPrefix') ?? ''),
        triageSystem: String(form.get('triageSystem') ?? ''),
        clinicalCatalog: { hospitalProfile },
      })
    },
    onSuccess: async () => {
      notify('Hospital profile saved', 'Branding and defaults updated hospital-wide.', 'success')
    },
  })

  return (
    <Card className="p-8">
      <PageHeader
        title="Hospital profile"
        description="Facility identity and operating defaults — not “tenant settings”."
      />

      <div className="mt-6 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-teal-900">
        <p className="font-semibold">Configuration dependency</p>
        <p className="mt-1">{CONFIG_DEPENDENCY_HINTS.hospitalProfile.join(' · ')}.</p>
      </div>

      <ClinicalForm
        key={settings?.patientIdPrefix ?? 'loading'}
        className="mt-8"
        onSubmit={(e) => submitClinicalForm(update, e, { resetOnSuccess: false })}
      >
        <FormSection title="Facility identity" columns={2}>
          <Field name="facilityName" label="Hospital name" defaultValue={profile.facilityName ?? settings?.tenant?.name} required />
          <Field name="shortName" label="Short name" defaultValue={profile.shortName ?? ''} />
          <Field name="mohFacilityCode" label="MOH facility code" defaultValue={profile.mohFacilityCode ?? settings?.tenant?.mohFacilityCode ?? ''} />
          <Field name="licenceNumber" label="Licence / registration no." defaultValue={profile.licenceNumber ?? settings?.tenant?.licenceNumber ?? ''} />
          <Field name="registrationNumber" label="Hospital registration number" defaultValue={profile.registrationNumber ?? ''} />
          <Field name="facilityLevel" label="Facility level" defaultValue={profile.facilityLevel ?? ''} placeholder="Level 4 / Level 5" />
          <Field name="ownership" label="Ownership" defaultValue={profile.ownership ?? ''} placeholder="Faith-based / Public / Private" />
          <Field name="hospitalType" label="Hospital type" defaultValue={profile.hospitalType ?? ''} placeholder="General / Specialist" />
        </FormSection>

        <FormSection title="Location & contact" columns={2}>
          <Field name="county" label="County" defaultValue={profile.county ?? ''} />
          <Field name="subCounty" label="Sub county" defaultValue={profile.subCounty ?? ''} />
          <Field name="physicalAddress" label="Physical address" defaultValue={profile.physicalAddress ?? profile.address ?? settings?.tenant?.address ?? ''} />
          <Field name="postalAddress" label="Postal address" defaultValue={profile.postalAddress ?? ''} />
          <Field name="address" label="Address line (legacy)" defaultValue={profile.address ?? ''} />
          <Field name="contactPhone" label="Phone" defaultValue={profile.contactPhone ?? ''} />
          <Field name="contactEmail" label="Email" defaultValue={profile.contactEmail ?? ''} />
          <Field name="website" label="Website" defaultValue={profile.website ?? ''} />
          <Field name="kraPin" label="KRA PIN" defaultValue={profile.kraPin ?? ''} />
        </FormSection>

        <FormSection title="Locale & operations" columns={2}>
          <Field name="timeZone" label="Time zone" defaultValue={profile.timeZone ?? 'Africa/Nairobi'} />
          <Field name="language" label="Language" defaultValue={profile.language ?? 'en'} />
          <Field name="currency" label="Currency" defaultValue={profile.currency ?? 'KES'} />
          <Field name="smsSenderName" label="SMS sender name" defaultValue={settings?.smsSenderName ?? ''} />
          <Field name="patientIdPrefix" label="Patient ID prefix" defaultValue={settings?.patientIdPrefix ?? ''} />
          <Field name="triageSystem" label="Triage system" defaultValue={settings?.triageSystem ?? ''} />
          <Field name="smsSignature" label="SMS signature (optional)" defaultValue={profile.smsSignature ?? ''} />
        </FormSection>

        <FormSection title="Branding assets" columns={2}>
          <Field name="primaryColor" label="Primary color" type="color" defaultValue={profile.primaryColor ?? '#0d9488'} />
          <Field name="accentColor" label="Accent color" type="color" defaultValue={profile.accentColor ?? '#0f766e'} />
          <Field name="logoUrl" label="Hospital logo URL" defaultValue={profile.logoUrl ?? ''} />
          <Field name="faviconUrl" label="Favicon URL" defaultValue={profile.faviconUrl ?? ''} />
          <Field name="stampUrl" label="Hospital stamp image URL" defaultValue={profile.stampUrl ?? ''} />
          <Field name="sealUrl" label="Hospital seal image URL" defaultValue={profile.sealUrl ?? ''} />
          <Field name="tagline" label="Tagline" defaultValue={profile.tagline ?? ''} />
          <div className="md:col-span-2">
            <Field name="footerText" label="Document footer" defaultValue={profile.footerText ?? ''} />
          </div>
        </FormSection>

        {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
        <FormActions>
          <Button type="submit" loading={update.isPending}>
            Save hospital profile
          </Button>
        </FormActions>
      </ClinicalForm>
    </Card>
  )
}
