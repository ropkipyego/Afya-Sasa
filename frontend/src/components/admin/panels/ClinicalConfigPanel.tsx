import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  ClinicalForm,
  FormActions,
  FormSection,
  PageHeader,
} from '../../ui'
import { apiRequest } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import { useClinicalCatalog } from '../../../hooks/useClinicalCatalog'
import { doctorSelectOptions, normalizeClinicalCatalog, type ClinicalCatalog } from '../../../lib/clinical-catalog'

function CatalogTextarea({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
      {hint ? <span className="mb-2 block text-xs text-slate-500">{hint}</span> : null}
      <textarea
        className="input min-h-[5rem] w-full font-mono text-sm"
        rows={rows}
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
    .map((line, index) => {
      const [value, label] = line.includes('|') ? line.split('|').map((s) => s.trim()) : [line, line]
      return {
        value: value.toLowerCase().replace(/\s+/g, '_'),
        label: label || value,
        sortOrder: index,
      }
    })
}

export function ClinicalConfigPanel() {
  const queryClient = useQueryClient()
  const { data: catalogData } = useClinicalCatalog()
  const staffDoctors = doctorSelectOptions(catalogData)
  const { data } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      apiRequest<{ clinicalCatalog?: Partial<ClinicalCatalog> }>('/admin/settings'),
  })

  const [departmentsText, setDepartmentsText] = useState('')
  const [clinicsText, setClinicsText] = useState('')
  const [specialtiesText, setSpecialtiesText] = useState('')
  const [visitTypesText, setVisitTypesText] = useState('')
  const [paymentMethodsText, setPaymentMethodsText] = useState('')
  const [referralSourcesText, setReferralSourcesText] = useState('')
  const [wardTypesText, setWardTypesText] = useState('')
  const [bedTypesText, setBedTypesText] = useState('')
  const [identifierLabelsText, setIdentifierLabelsText] = useState('')

  useEffect(() => {
    const catalog = normalizeClinicalCatalog(data?.clinicalCatalog)
    setDepartmentsText(catalog.departments.join('\n'))
    setClinicsText(catalog.clinics.join('\n'))
    setSpecialtiesText(catalog.doctorSpecialties.join('\n'))
    setVisitTypesText(catalog.visitTypes.map((v) => `${v.value}|${v.label}`).join('\n'))
    setPaymentMethodsText(catalog.paymentMethods.map((v) => `${v.value}|${v.label}`).join('\n'))
    setReferralSourcesText(catalog.referralSources.map((v) => `${v.value}|${v.label}`).join('\n'))
    setWardTypesText(catalog.wardTypes.map((v) => `${v.value}|${v.label}`).join('\n'))
    setBedTypesText(catalog.bedTypes.map((v) => `${v.value}|${v.label}`).join('\n'))
    setIdentifierLabelsText(catalog.identifierLabels.map((v) => `${v.value}|${v.label}`).join('\n'))
  }, [data])

  const splitLines = (value: string) =>
    value.split('\n').map((line) => line.trim()).filter(Boolean)

  const update = useMutation({
    mutationFn: () =>
      apiRequest('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          clinicalCatalog: {
            ...(data?.clinicalCatalog ?? {}),
            departments: splitLines(departmentsText),
            clinics: splitLines(clinicsText),
            doctorSpecialties: splitLines(specialtiesText),
            doctorCategories: splitLines(specialtiesText),
            visitTypes: linesToOptions(visitTypesText),
            paymentMethods: linesToOptions(paymentMethodsText),
            referralSources: linesToOptions(referralSourcesText),
            wardTypes: linesToOptions(wardTypesText),
            bedTypes: linesToOptions(bedTypesText),
            identifierLabels: linesToOptions(identifierLabelsText),
          },
        }),
      }),
    onSuccess: async () => {
      notify('Clinical catalog saved', 'All dropdowns updated hospital-wide.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-catalog'] })
    },
  })

  return (
    <Card className="p-8">
      <PageHeader
        title="Clinical configuration"
        description="All dropdowns across reception, OPD, and IPD — no hardcoded lists."
      />
      <ClinicalForm onSubmit={(e) => { e.preventDefault(); update.mutate() }}>
        <FormSection
          title="Reception & OPD"
          description="One item per line. For value|label pairs use: new|New visit"
          columns={1}
        >
          <CatalogTextarea label="Departments" value={departmentsText} onChange={setDepartmentsText} />
          <CatalogTextarea label="Clinics" value={clinicsText} onChange={setClinicsText} />
          <CatalogTextarea label="Visit types" value={visitTypesText} onChange={setVisitTypesText} placeholder="new|New visit" />
          <CatalogTextarea label="Referral sources" value={referralSourcesText} onChange={setReferralSourcesText} />
          <CatalogTextarea label="Payment methods" value={paymentMethodsText} onChange={setPaymentMethodsText} />
          <CatalogTextarea label="Doctor specialties" value={specialtiesText} onChange={setSpecialtiesText} />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Assignable doctors</p>
            <p className="mt-1 text-xs text-slate-500">
              Doctors are loaded from active user accounts with the doctor, consultant, or clinical officer role.
              Manage them under Hospital Settings → Users.
            </p>
            {staffDoctors.length ? (
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {staffDoctors.map((doctor) => (
                  <li key={doctor.value}>• {doctor.label}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-amber-700">No doctor accounts found. Create users and assign the doctor role.</p>
            )}
          </div>
        </FormSection>
        <FormSection title="Identifiers" description="value|label per line — e.g. national_id|ID Number" columns={1}>
          <CatalogTextarea value={identifierLabelsText} onChange={setIdentifierLabelsText} label="Patient identifier labels" />
        </FormSection>
        <FormSection title="IPD" columns={1}>
          <CatalogTextarea label="Ward types" value={wardTypesText} onChange={setWardTypesText} placeholder="general|General Ward" />
          <CatalogTextarea label="Bed types" value={bedTypesText} onChange={setBedTypesText} placeholder="standard|Standard" />
        </FormSection>
        {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
        <FormActions>
          <Button type="submit" loading={update.isPending}>Save clinical catalog</Button>
        </FormActions>
      </ClinicalForm>
    </Card>
  )
}
