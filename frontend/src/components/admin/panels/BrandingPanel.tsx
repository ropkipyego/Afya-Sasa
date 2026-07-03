import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Card, ClinicalForm, Field, FormActions, FormSection, PageHeader } from '../../ui'
import { formDataFromElement, submitClinicalForm } from '../../../lib/form-utils'
import { notify } from '../../../lib/notify'
import { useHospitalConfiguration } from '../../../hooks/useHospitalConfiguration'
import type { HospitalProfile } from '../../../lib/clinical-catalog'
import { CONFIG_DEPENDENCY_HINTS } from '../../../lib/hospital-configuration'

export function BrandingPanel() {
  const { catalog, saveSettings } = useHospitalConfiguration()
  const profile = catalog.hospitalProfile ?? {}

  const update = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const hospitalProfile: Partial<HospitalProfile> = {
        ...profile,
        facilityName: String(form.get('facilityName') ?? profile.facilityName ?? ''),
        primaryColor: String(form.get('primaryColor') ?? '#0d9488'),
        accentColor: String(form.get('accentColor') ?? '#0f766e'),
        logoUrl: String(form.get('logoUrl') ?? ''),
        faviconUrl: String(form.get('faviconUrl') ?? ''),
        footerText: String(form.get('footerText') ?? ''),
        tagline: String(form.get('tagline') ?? ''),
      }
      return saveSettings.mutateAsync({ clinicalCatalog: { hospitalProfile } })
    },
    onSuccess: () => {
      notify('Branding saved', 'Login, navigation, and printouts will use the new identity.', 'success')
    },
  })

  return (
    <Card className="p-8">
      <PageHeader
        title="Branding & theme"
        description="One logo upload updates login, sidebar, patient cards, PDFs, and letterhead."
      />

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold">Configuration dependency</p>
        <p className="mt-1">{CONFIG_DEPENDENCY_HINTS.hospitalProfile.join(' · ')}.</p>
      </div>

      <ClinicalForm className="mt-8" onSubmit={(e) => submitClinicalForm(update, e)}>
        <FormSection title="Visual identity" columns={2}>
          <Field name="facilityName" label="Hospital name (display)" defaultValue={profile.facilityName} required />
          <Field name="primaryColor" label="Primary color" type="color" defaultValue={profile.primaryColor ?? '#0d9488'} />
          <Field name="accentColor" label="Accent color" type="color" defaultValue={profile.accentColor ?? '#0f766e'} />
          <Field name="logoUrl" label="Logo URL" defaultValue={profile.logoUrl ?? ''} placeholder="https://…/logo.png" />
          <Field name="faviconUrl" label="Favicon URL" defaultValue={profile.faviconUrl ?? ''} />
          <Field name="tagline" label="Tagline" defaultValue={profile.tagline ?? ''} />
          <div className="md:col-span-2">
            <Field name="footerText" label="Document footer" defaultValue={profile.footerText ?? ''} />
          </div>
        </FormSection>

        <div
          className="mt-6 rounded-2xl border border-slate-200 p-6"
          style={{ borderTopColor: profile.primaryColor ?? '#0d9488', borderTopWidth: 4 }}
        >
          <p className="text-xs font-bold uppercase text-slate-500">Live preview</p>
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt="" className="mt-3 h-12 object-contain" />
          ) : null}
          <p className="mt-2 text-lg font-bold" style={{ color: profile.primaryColor ?? '#0d9488' }}>
            {profile.facilityName ?? 'Hospital name'}
          </p>
          {profile.tagline ? <p className="text-sm text-slate-600">{profile.tagline}</p> : null}
          {profile.footerText ? <p className="mt-4 text-xs text-slate-400">{profile.footerText}</p> : null}
        </div>

        {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
        <FormActions>
          <Button type="submit" loading={update.isPending}>
            Save branding
          </Button>
        </FormActions>
      </ClinicalForm>
    </Card>
  )
}
