import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, ClinicalForm, Field, FormActions, FormSection, PageHeader } from '../../ui'
import { formDataFromElement, submitClinicalForm } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import type { ClinicalCatalog, HospitalProfile } from '../../../lib/clinical-catalog'
import { normalizeClinicalCatalog } from '../../../lib/clinical-catalog'
import { defaultPrintTemplates } from '../../../lib/template-engine'

export function BrandingPanel() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiRequest<{ clinicalCatalog?: Partial<ClinicalCatalog> }>('/admin/settings'),
  })

  const catalog = normalizeClinicalCatalog(data?.clinicalCatalog)
  const profile = catalog.hospitalProfile ?? {}
  const [templateKey, setTemplateKey] = useState('sick_sheet')
  const [templateHtml, setTemplateHtml] = useState(
    () => catalog.printTemplates?.sick_sheet?.html ?? defaultPrintTemplates.sick_sheet.html,
  )

  useEffect(() => {
    setTemplateHtml(
      catalog.printTemplates?.[templateKey]?.html ?? defaultPrintTemplates[templateKey]?.html ?? '',
    )
  }, [data, templateKey])

  const update = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      const hospitalProfile: Partial<HospitalProfile> = {
        ...profile,
        facilityName: String(form.get('facilityName') ?? profile.facilityName ?? ''),
        primaryColor: String(form.get('primaryColor') ?? '#0d9488'),
        logoUrl: String(form.get('logoUrl') ?? ''),
        footerText: String(form.get('footerText') ?? ''),
        tagline: String(form.get('tagline') ?? ''),
      }
      return apiRequest('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          clinicalCatalog: { ...data?.clinicalCatalog, hospitalProfile },
        }),
      })
    },
    onSuccess: async () => {
      notify('Branding saved', 'Theme and letterhead settings updated.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
    },
  })

  const saveTemplate = useMutation({
    mutationFn: () => {
      const name = defaultPrintTemplates[templateKey]?.name ?? templateKey
      const printTemplates = {
        ...(catalog.printTemplates ?? {}),
        [templateKey]: { name, html: templateHtml },
      }
      return apiRequest('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          clinicalCatalog: { ...data?.clinicalCatalog, printTemplates },
        }),
      })
    },
    onSuccess: async () => {
      notify('Print template saved', 'Template will be used for new print jobs.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
    },
  })

  return (
    <Card className="p-8">
      <PageHeader
        title="Branding & theme"
        description="Colors, logo URL, and footer text used on patient cards and printable documents."
      />
        <ClinicalForm className="mt-8" onSubmit={(e) => submitClinicalForm(update, e)}>
          <FormSection title="Branding" columns={2}>
          <Field name="facilityName" label="Hospital name (display)" defaultValue={profile.facilityName} required />
          <Field name="primaryColor" label="Primary color" type="color" defaultValue={profile.primaryColor ?? '#0d9488'} />
          <Field name="logoUrl" label="Logo URL" defaultValue={profile.logoUrl ?? ''} placeholder="https://…/logo.png" />
          <Field name="tagline" label="Tagline" defaultValue={profile.tagline ?? ''} placeholder="Quality care, every patient" />
          <div className="md:col-span-2">
            <Field name="footerText" label="Document footer" defaultValue={profile.footerText ?? ''} placeholder="Confidential medical record" />
          </div>
        </FormSection>
        <div
          className="mt-6 rounded-2xl border border-slate-200 p-6"
          style={{ borderTopColor: profile.primaryColor ?? '#0d9488', borderTopWidth: 4 }}
        >
          <p className="text-xs font-bold uppercase text-slate-500">Preview</p>
          <p className="mt-2 text-lg font-bold" style={{ color: profile.primaryColor ?? '#0d9488' }}>
            {profile.facilityName ?? 'Hospital name'}
          </p>
          {profile.tagline ? <p className="text-sm text-slate-600">{profile.tagline}</p> : null}
          {profile.footerText ? <p className="mt-4 text-xs text-slate-400">{profile.footerText}</p> : null}
        </div>
        {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
        <FormActions>
          <Button type="submit" loading={update.isPending}>Save branding</Button>
        </FormActions>
      </ClinicalForm>

      <div className="mt-10 border-t border-slate-200 pt-8">
        <PageHeader
          title="Print templates"
          description="Customize HTML for sick sheets, referral letters, and patient cards. Use {{variable}} placeholders."
        />
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-800">
            Template
            <select
              className="input mt-1.5 w-full max-w-xs"
              value={templateKey}
              onChange={(e) => {
                const key = e.target.value
                setTemplateKey(key)
                setTemplateHtml(
                  catalog.printTemplates?.[key]?.html ?? defaultPrintTemplates[key]?.html ?? '',
                )
              }}
            >
              {Object.entries(defaultPrintTemplates).map(([key, t]) => (
                <option key={key} value={key}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <textarea
            className="input min-h-[240px] w-full font-mono text-xs"
            value={templateHtml}
            onChange={(e) => setTemplateHtml(e.target.value)}
          />
          {saveTemplate.error ? <Alert tone="error">{saveTemplate.error.message}</Alert> : null}
          <Button type="button" loading={saveTemplate.isPending} onClick={() => saveTemplate.mutate()}>
            Save template
          </Button>
        </div>
      </div>
    </Card>
  )
}
