import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Alert, Button, Card, Field, PageHeader, SelectField } from '../../ui'
import { apiRequest, formatApiError } from '../../../lib/api'
import { parseSimpleCsv } from '../../../lib/catalog-preview'
import { formatKes } from '../../../lib/clinical-catalog'
import { notify } from '../../../lib/notify'
import { readSpreadsheetAsCsv, SPREADSHEET_UPLOAD_ACCEPT } from '../../../lib/spreadsheet-import'

type ChargeItem = {
  code: string
  name: string
  category: string
  chargeType: string
  unit: string
  unitPrice: number | null
  active: boolean
  automatic: boolean
  recurrence: string
}

type Catalogue = {
  policy: {
    dayCount: string
    sameDay: string
    dayAnchor: string
    timeZone: string
    blockDischargeOnBalance: boolean
  }
  items: ChargeItem[]
  total?: number
  page?: number
  pageSize?: number
  mappingRules?: string[]
  job: {
    lastRunAt: string | null
    lastSuccessAt: string | null
    lastGenerated: number
    lastSkipped: number
    lastErrors: string[]
    lastAdmissions: number
    lastMessage: string | null
  }
}

type ImportPreview = {
  total: number
  importable: number
  reviewRequired: number
  zeroPriced: number
  rows: Array<{
    matchKind: string
    matchedCode?: string
    flags: string[]
    importable: boolean
    row: { code?: string; name?: string; unitPrice?: number | null; unit?: string }
  }>
}

type JobStatus = {
  enabled: boolean
  lastRunAt: string | null
  lastGenerated: number
  lastSkipped: number
  lastErrors: string[]
  lastAdmissions: number
  lastMessage: string | null
  unpricedAutomaticItems: Array<{ code: string; name: string }>
}

export function HospitalChargeCataloguePanel() {
  const queryClient = useQueryClient()
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [review, setReview] = useState('')
  const [page, setPage] = useState(1)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importRows, setImportRows] = useState<Array<Record<string, unknown>>>([])

  const catalogueQuery = useQuery({
    queryKey: ['hospital-charge-catalogue', query, review, page],
    queryFn: () =>
      apiRequest<Catalogue>(
        `/payments/charge-catalogue?q=${encodeURIComponent(query)}&review=${encodeURIComponent(review)}&page=${page}&pageSize=25`,
      ),
  })
  const jobQuery = useQuery({
    queryKey: ['accommodation-charge-job'],
    queryFn: () => apiRequest<JobStatus>('/payments/charges/accommodation/job'),
  })

  const catalogue = catalogueQuery.data
  const items = useMemo(() => catalogue?.items ?? [], [catalogue])

  const save = useMutation({
    mutationFn: (body: Partial<Catalogue>) =>
      apiRequest('/payments/charge-catalogue', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      notify('Charge catalogue saved', 'New rates apply to new charges only. Posted history is unchanged.', 'success')
      setDraftPrices({})
      await queryClient.invalidateQueries({ queryKey: ['hospital-charge-catalogue'] })
      await queryClient.invalidateQueries({ queryKey: ['accommodation-charge-job'] })
    },
    onError: (error: Error) =>
      notify('Could not save catalogue', formatApiError(error, 'Could not save the charge catalogue.'), 'critical'),
  })

  const previewImport = useMutation({
    mutationFn: (rows: Array<Record<string, unknown>>) =>
      apiRequest<ImportPreview>('/payments/charge-catalogue/import/preview', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),
    onSuccess: (result, rows) => {
      setImportRows(rows)
      setImportPreview(result)
      notify('Import preview ready', `${result.importable} importable · ${result.reviewRequired} need review. Nothing was saved.`, 'success')
    },
    onError: (error: Error) =>
      notify('Preview failed', formatApiError(error, 'Could not preview the charge catalogue import.'), 'critical'),
  })

  const confirmImport = useMutation({
    mutationFn: (rows: Array<Record<string, unknown>>) =>
      apiRequest('/payments/charge-catalogue/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),
    onSuccess: async () => {
      notify('Catalogue import applied', 'Only priced, non-ambiguous rows were merged. Historical charges were not changed.', 'success')
      setImportPreview(null)
      setImportRows([])
      await queryClient.invalidateQueries({ queryKey: ['hospital-charge-catalogue'] })
    },
    onError: (error: Error) =>
      notify('Import failed', formatApiError(error, 'Could not confirm the catalogue import.'), 'critical'),
  })

  const process = useMutation({
    mutationFn: () =>
      apiRequest<{ generated?: number; skipped?: number }>('/payments/charges/accommodation/process', {
        method: 'POST',
      }),
    onSuccess: async (result) => {
      notify(
        'Accommodation job finished',
        `${result.generated ?? 0} created · ${result.skipped ?? 0} already existed or unpriced.`,
        'success',
      )
      await queryClient.invalidateQueries({ queryKey: ['accommodation-charge-job'] })
    },
    onError: (error: Error) =>
      notify('Charge job failed', formatApiError(error, 'Accommodation charge job failed.'), 'critical'),
  })

  if (catalogueQuery.isLoading) {
    return <p className="py-16 text-center text-slate-500">Loading hospital charge catalogue…</p>
  }
  if (catalogueQuery.isError || !catalogue) {
    return (
      <Alert tone="error">
        {catalogueQuery.error instanceof Error
          ? formatApiError(catalogueQuery.error, 'Unable to load the charge catalogue.')
          : 'Unable to load the charge catalogue.'}
      </Alert>
    )
  }

  const savePrices = () => {
    const nextItems = items.map((item) => {
      if (!(item.code in draftPrices)) return item
      const raw = draftPrices[item.code].trim()
      return {
        ...item,
        unitPrice: raw === '' ? null : Number(raw),
      }
    })
    save.mutate({ items: nextItems, policy: catalogue.policy })
  }

  return (
    <Card className="space-y-8 p-8">
      <PageHeader
        title="Billable service & tariff catalogue"
        description="Hospital-wide tariffs for OPD, IPD, lab, imaging, pharmacy, theatre and other services. QuickBooks remains the general ledger. Empty or zero rates are never posted as KSh 0 charges."
      />
      {catalogue.mappingRules?.length ? (
        <Alert tone="info">{catalogue.mappingRules[0]} Use jalaram_hospital_charge_mapping.xlsx as the controlled mapping source — do not auto-import it.</Alert>
      ) : null}
      <section className="rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Controlled import</h3>
        <p className="mt-2 text-sm text-slate-600">
          Upload a mapping sheet, preview matches, then approve. Zero-priced and near-duplicate rows stay in review and are never posted as KSh 0 charges.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Mapping workbook / CSV
          <input
            className="input mt-1"
            type="file"
            accept={SPREADSHEET_UPLOAD_ACCEPT}
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              try {
                const csv = await readSpreadsheetAsCsv(file, ['Mapped_Charges', 'mapped_charges', 'Sheet1'])
                const parsed = parseSimpleCsv(csv).map(mapImportRow).filter((row) => row.name || row.code)
                if (!parsed.length) {
                  notify('No usable rows', 'The file had no service name or item code columns.', 'critical')
                  return
                }
                previewImport.mutate(parsed)
              } catch (error) {
                notify(
                  'Could not read file',
                  error instanceof Error ? error.message : 'The spreadsheet could not be parsed.',
                  'critical',
                )
              }
            }}
          />
        </label>
        {importPreview ? (
          <div className="mt-4 space-y-3">
            <Alert tone="info">
              {importPreview.importable} importable · {importPreview.reviewRequired} review · {importPreview.zeroPriced} zero-priced. Preview only — nothing is saved until you approve.
            </Alert>
            <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Match</th>
                    <th className="px-3 py-2">Flags</th>
                    <th className="px-3 py-2">Import?</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.slice(0, 50).map((row, index) => (
                    <tr key={`${row.row.code ?? row.row.name}-${index}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.row.name ?? '—'}</td>
                      <td className="px-3 py-2">{row.matchKind}{row.matchedCode ? ` · ${row.matchedCode}` : ''}</td>
                      <td className="px-3 py-2">{row.flags.join(', ') || '—'}</td>
                      <td className="px-3 py-2">{row.importable ? 'Yes' : 'Review'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" loading={confirmImport.isPending} disabled={!importPreview.importable} onClick={() => confirmImport.mutate(importRows)}>
              Approve priced rows
            </Button>
          </div>
        ) : null}
      </section>
      <div className="flex flex-wrap gap-3">
        <Field name="q" label="Search" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value) }} />
        <SelectField name="review" label="Review" value={review} onChange={(event) => { setPage(1); setReview(event.target.value) }}>
          <option value="">All</option>
          <option value="unpriced">Unpriced / needs hospital price</option>
          <option value="zero">Zero-price source rows</option>
        </SelectField>
      </div>

      <Alert tone="info">
        KenyaEMR and SHA treat IPD bed charges as a billable-service / per-diem catalogue, not a hardcoded fee.
        Bahmni keeps bed occupancy history (start/stop) separate from the bill. AfyaSasa follows that split:
        occupancy comes from admission + transfers; the rate comes from this catalogue; posted charges stay on
        the existing operational charges ledger. QuickBooks remains the general ledger.
      </Alert>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Charging policy</h3>
          <p className="mt-2 text-sm text-slate-600">
            Do not assume midnight, calendar, or 24-hour rules. Pick the hospital rule, then save.
          </p>
          <div className="mt-4 space-y-3">
            <SelectField
              name="dayCount"
              label="Billable day rule"
              value={catalogue.policy.dayCount}
              onChange={(event) =>
                save.mutate({
                  policy: { ...catalogue.policy, dayCount: event.target.value },
                  items,
                })
              }
            >
              <option value="calendar_exclude_discharge">Calendar days, exclude discharge day</option>
              <option value="calendar_inclusive">Every calendar day including discharge</option>
              <option value="calendar_exclude_admission">Calendar days, exclude admission day</option>
              <option value="nights_only">Nights / SHA overnight (same-day = 0)</option>
              <option value="twenty_four_hour">Completed 24-hour periods</option>
            </SelectField>
            <SelectField
              name="sameDay"
              label="Same-day admission / discharge"
              value={catalogue.policy.sameDay}
              onChange={(event) =>
                save.mutate({
                  policy: { ...catalogue.policy, sameDay: event.target.value },
                  items,
                })
              }
            >
              <option value="minimum_one">Charge at least one day</option>
              <option value="none">No charge unless a night is spent</option>
              <option value="follow_day_count">Follow the day-count rule only</option>
            </SelectField>
            <SelectField
              name="dayAnchor"
              label="Which bed owns a transfer day?"
              value={catalogue.policy.dayAnchor}
              onChange={(event) =>
                save.mutate({
                  policy: { ...catalogue.policy, dayAnchor: event.target.value },
                  items,
                })
              }
            >
              <option value="start_of_day">Morning / start-of-day bed</option>
              <option value="end_of_day">Evening / end-of-day bed</option>
            </SelectField>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Automatic charging</h3>
          <p className="mt-2 text-sm text-slate-600">
            Last run {jobQuery.data?.lastRunAt ? new Date(jobQuery.data.lastRunAt).toLocaleString() : 'not yet'}
            {jobQuery.data ? ` · ${jobQuery.data.lastGenerated} created · ${jobQuery.data.lastSkipped} skipped` : ''}
          </p>
          {jobQuery.data?.lastMessage ? (
            <p className="mt-2 text-sm text-slate-500">{jobQuery.data.lastMessage}</p>
          ) : null}
          {jobQuery.data?.unpricedAutomaticItems?.length ? (
            <Alert tone="warning" className="mt-4">
              Waiting for hospital rates: {jobQuery.data.unpricedAutomaticItems.map((row) => row.name).join(', ')}.
            </Alert>
          ) : null}
          <div className="mt-4">
            <Button type="button" variant="secondary" loading={process.isPending} onClick={() => process.mutate()}>
              Run accommodation charges now
            </Button>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Charge</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3 text-right">Rate (KSh)</th>
              <th className="px-3 py-3">Automatic?</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.code} className="border-t border-slate-100">
                <td className="px-3 py-3">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.code}</p>
                </td>
                <td className="px-3 py-3 capitalize">{item.category}</td>
                <td className="px-3 py-3 text-right">
                  <Field
                    name={`price-${item.code}`}
                    label=""
                    inputMode="decimal"
                    placeholder={item.unitPrice != null ? String(item.unitPrice) : 'Not set'}
                    value={item.code in draftPrices ? draftPrices[item.code] : item.unitPrice ?? ''}
                    onChange={(event) =>
                      setDraftPrices((current) => ({ ...current, [item.code]: event.target.value }))
                    }
                  />
                  {item.unitPrice != null && !(item.code in draftPrices) ? (
                    <p className="mt-1 text-xs text-slate-500">{formatKes(item.unitPrice)} / {item.unit}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3">{item.automatic ? 'Yes' : 'Manual'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" loading={save.isPending} onClick={savePrices}>
          Save rates
        </Button>
        <p className="text-sm text-slate-500">
          {catalogue.total ?? items.length} services · page {catalogue.page ?? 1}
        </p>
        <Button type="button" variant="secondary" disabled={(catalogue.page ?? 1) <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={((catalogue.page ?? 1) * (catalogue.pageSize ?? 25)) >= (catalogue.total ?? items.length)}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </Button>
      </div>
    </Card>
  )
}

function firstValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (row[key]?.trim()) return row[key].trim()
  }
  return ''
}

function mapImportRow(row: Record<string, string>) {
  const priceRaw = firstValue(row, ['price', 'gross_price', 'unit_price', 'rate', 'hospital_price'])
  const parsed = priceRaw === '' ? null : Number(String(priceRaw).replace(/[^0-9.-]/g, ''))
  return {
    code: firstValue(row, ['code', 'item_code', 'itemcode', 'sku']),
    name: firstValue(row, ['name', 'item', 'description', 'service', 'source_name']),
    sourceItemCode: firstValue(row, ['item_code', 'source_item_code', 'code']),
    sourceName: firstValue(row, ['source_name', 'item', 'name', 'description']),
    department: firstValue(row, ['department', 'dept', 'category']),
    category: firstValue(row, ['category', 'type', 'service_type']),
    unit: firstValue(row, ['unit', 'u_m', 'um', 'billing_unit']),
    unitPrice: parsed == null || !Number.isFinite(parsed) ? null : parsed,
    account: firstValue(row, ['account']),
    cogsAccount: firstValue(row, ['cogs_account', 'cogs']),
    assetAccount: firstValue(row, ['asset_account', 'asset']),
    vat: firstValue(row, ['vat', 'tax']),
    supplier: firstValue(row, ['supplier']),
  }
}
