import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, ClinicalForm, FormActions, FormSection, PageHeader } from '../../ui'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import type { ClinicalCatalog } from '../../../lib/clinical-catalog'
import { normalizeClinicalCatalog } from '../../../lib/clinical-catalog'

function CatalogTextarea({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
      {hint ? <span className="mb-2 block text-xs text-slate-500">{hint}</span> : null}
      <textarea
        className="input min-h-[5rem] w-full font-mono text-sm"
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function linesToOptions(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.includes('|') ? line.split('|').map((s) => s.trim()) : [line, line]
      return { value: value.toLowerCase().replace(/\s+/g, '_'), label: label || value }
    })
}

export function MaternityConfigPanel() {
  const queryClient = useQueryClient()
  const { data: dashboard } = useQuery({
    queryKey: ['maternity-dashboard'],
    queryFn: () =>
      apiRequest<{
        ancPatientsToday: number
        mothersInLabour: number
        postnatalMothers: number
        nurseryBabies: number
      }>('/maternity/dashboard'),
  })
  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiRequest<{ clinicalCatalog?: Partial<ClinicalCatalog> }>('/admin/settings'),
  })

  const [deliveryTypesText, setDeliveryTypesText] = useState('')
  const [ancTemplatesText, setAncTemplatesText] = useState('')

  useEffect(() => {
    const catalog = normalizeClinicalCatalog(settings?.clinicalCatalog)
    setDeliveryTypesText(
      (catalog.maternityDeliveryTypes ?? [])
        .map((v) => `${v.value}|${v.label}`)
        .join('\n') || 'normal_vaginal|Normal vaginal\ncaesarean|Caesarean section\nassisted|Assisted delivery',
    )
    setAncTemplatesText(
      (catalog.maternityAncTemplates ?? [])
        .map((v) => `${v.value}|${v.label}`)
        .join('\n') || 'routine|Routine ANC\nhigh_risk|High-risk ANC\npostnatal|Postnatal review',
    )
  }, [settings])

  const update = useMutation({
    mutationFn: () =>
      apiRequest('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          clinicalCatalog: {
            ...(settings?.clinicalCatalog ?? {}),
            maternityDeliveryTypes: linesToOptions(deliveryTypesText),
            maternityAncTemplates: linesToOptions(ancTemplatesText),
          },
        }),
      }),
    onSuccess: async () => {
      notify('Maternity config saved', 'Delivery types and ANC templates updated.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
    },
  })

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <PageHeader
          title="Maternity configuration"
          description="Service-line status and configurable delivery / ANC options."
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            { label: 'ANC patients', value: dashboard?.ancPatientsToday ?? 0 },
            { label: 'In labour', value: dashboard?.mothersInLabour ?? 0 },
            { label: 'Postnatal', value: dashboard?.postnatalMothers ?? 0 },
            { label: 'Nursery', value: dashboard?.nurseryBabies ?? 0 },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">{item.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Ward units (ANC, Labour, Postnatal, Nursery) are managed under Facilities → Wards & beds and the Maternity module.
        </p>
      </Card>

      <Card className="p-8">
        <ClinicalForm onSubmit={(e) => { e.preventDefault(); update.mutate() }}>
          <FormSection title="Catalog options" description="value|label per line" columns={1}>
            <CatalogTextarea
              label="Delivery types"
              value={deliveryTypesText}
              onChange={setDeliveryTypesText}
              placeholder="normal_vaginal|Normal vaginal"
            />
            <CatalogTextarea
              label="ANC visit templates"
              value={ancTemplatesText}
              onChange={setAncTemplatesText}
              placeholder="routine|Routine ANC"
            />
          </FormSection>
          {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
          <FormActions>
            <Button type="submit" loading={update.isPending}>Save maternity config</Button>
          </FormActions>
        </ClinicalForm>
      </Card>
    </div>
  )
}
