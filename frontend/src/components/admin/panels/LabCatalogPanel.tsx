import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Alert, Button, Card, ClinicalForm, Field, FormActions, FormSection, PageHeader, SelectField } from '../../ui'
import { formDataFromElement, submitClinicalForm } from '../../../lib/form-utils'
import { apiRequest } from '../../../lib/api'
import { formatConfiguredPrice } from '../../../lib/clinical-catalog'
import { notify } from '../../../lib/notify'
import { classifyAgainstCatalog, parseSimpleCsv } from '../../../lib/catalog-preview'
import { readSpreadsheetAsCsv, SPREADSHEET_UPLOAD_ACCEPT } from '../../../lib/spreadsheet-import'

type LabPanel = { id: string; name: string; code: string; category: string; description?: string | null }
type LabTest = {
  id: string
  name: string
  code: string
  sampleType: string
  referenceRange?: string | null
  unit?: string | null
  turnaroundHours?: number | null
  panel?: { name: string } | null
}
type CatalogTest = {
  id: string
  name: string
  code: string
  isPanel: boolean
  sell?: number
  standardTatMinutes?: number
  department?: { name: string; code: string }
  specimen?: { name: string; code: string }
}
type CatalogDepartment = { id: string; code: string; name: string }

const categories = [
  'haematology',
  'biochemistry',
  'microbiology',
  'immunology',
  'urinalysis',
  'coagulation',
] as const

const sampleTypes = [
  'whole_blood',
  'serum',
  'plasma',
  'urine',
  'swab',
  'stool',
  'csf',
  'tissue',
] as const

function csvCell(value: string | number | undefined) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadTextFile(filename: string, href: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
}

function downloadGeneratedCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  downloadTextFile(filename, href)
  URL.revokeObjectURL(href)
}

export function LabCatalogPanel() {
  const queryClient = useQueryClient()
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [lisImportSummary, setLisImportSummary] = useState<string | null>(null)
  const [priceImportSummary, setPriceImportSummary] = useState<string | null>(null)
  const [pricePreview, setPricePreview] = useState<{
    csv: string
    rows: Array<{ name: string; code: string; sell: string; kind: string; match: string }>
  } | null>(null)
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({})
  const [priceQuery, setPriceQuery] = useState('')
  const { data: panels = [], isLoading: panelsLoading } = useQuery({
    queryKey: ['lab-panels'],
    queryFn: () => apiRequest<LabPanel[]>('/laboratory/panels'),
  })
  const { data: tests = [], isLoading: testsLoading } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: () => apiRequest<LabTest[]>('/laboratory/tests'),
  })
  const { data: catalogTests = [], isLoading: catalogLoading } = useQuery({
    queryKey: ['lab-catalog-tests'],
    queryFn: () => apiRequest<CatalogTest[]>('/laboratory/catalog/tests'),
  })
  const { data: departments = [] } = useQuery({
    queryKey: ['lab-catalog-departments'],
    queryFn: () => apiRequest<CatalogDepartment[]>('/laboratory/catalog/departments'),
  })

  const catalogPanels = catalogTests.filter((test) => test.isPanel)
  const catalogSingles = catalogTests.filter((test) => !test.isPanel)

  const createPanel = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/laboratory/panels', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code'),
          description: form.get('description') || undefined,
          category: form.get('category'),
        }),
      })
    },
    onSuccess: async () => {
      notify('Panel added', 'Laboratory panel saved.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['lab-panels'] })
    },
  })

  const importCatalog = useMutation({
    mutationFn: (csv: string) =>
      apiRequest<{
        panelsCreated: number
        panelsSkipped: number
        testsCreated: number
        testsSkipped: number
        errors: string[]
      }>('/laboratory/tests/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    onSuccess: async (summary) => {
      const message = `Panels +${summary.panelsCreated} / tests +${summary.testsCreated}${
        summary.errors.length ? ` · ${summary.errors.length} row warning(s)` : ''
      }`
      setImportSummary(message)
      notify('Catalog imported', message, summary.errors.length ? 'warning' : 'success')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lab-panels'] }),
        queryClient.invalidateQueries({ queryKey: ['lab-tests'] }),
        queryClient.invalidateQueries({ queryKey: ['clinical-order-panels'] }),
        queryClient.invalidateQueries({ queryKey: ['clinical-order-tests'] }),
      ])
    },
    onError: (error: Error) => notify('Import failed', error.message, 'critical'),
  })

  const importLisCatalog = useMutation({
    mutationFn: (csv: string) =>
      apiRequest<{
        departmentsCreated: number
        specimensCreated: number
        testsCreated: number
        testsUpdated: number
        testsSkipped: number
        parametersCreated: number
        priced?: number
        errors: string[]
      }>('/laboratory/catalog/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    onSuccess: async (summary) => {
      const message = `LIS tests +${summary.testsCreated} updated ${summary.testsUpdated} · parameters +${summary.parametersCreated}${
        summary.priced ? ` · ${summary.priced} priced` : ''
      }${
        summary.errors.length ? ` · ${summary.errors.length} row warning(s)` : ''
      }`
      setLisImportSummary(message)
      notify('LIS catalog imported', message, summary.errors.length ? 'warning' : 'success')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lab-catalog-tests'] }),
        queryClient.invalidateQueries({ queryKey: ['lab-catalog-departments'] }),
        queryClient.invalidateQueries({ queryKey: ['clinical-order-catalog-tests'] }),
      ])
    },
    onError: (error: Error) => notify('LIS import failed', error.message, 'critical'),
  })

  const importPrices = useMutation({
    mutationFn: (csv: string) =>
      apiRequest<{
        priced: number
        matched: string[]
        unmatched: string[]
        ambiguous: string[]
        errors: string[]
      }>('/laboratory/catalog/prices/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    onSuccess: async (summary) => {
      const message = `${summary.priced} prices saved · ${summary.unmatched.length} unmatched · ${summary.ambiguous.length} ambiguous`
      setPriceImportSummary(
        [
          message,
          summary.unmatched.length ? `Unmatched: ${summary.unmatched.join(', ')}` : '',
          summary.ambiguous.length ? `Ambiguous: ${summary.ambiguous.join(', ')}` : '',
          summary.errors.slice(0, 4).join(' · '),
        ]
          .filter(Boolean)
          .join(' · '),
      )
      notify(
        'Lab prices imported',
        message,
        summary.unmatched.length || summary.ambiguous.length || summary.errors.length ? 'warning' : 'success',
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lab-catalog-tests'] }),
        queryClient.invalidateQueries({ queryKey: ['clinical-order-catalog-tests'] }),
      ])
    },
    onError: (error: Error) => notify('Price import failed', error.message, 'critical'),
  })

  const createTest = useMutation({
    mutationFn: (formElement: HTMLFormElement) => {
      const form = formDataFromElement(formElement)
      return apiRequest('/laboratory/tests', {
        method: 'POST',
        body: JSON.stringify({
          panelId: form.get('panelId') || undefined,
          name: form.get('name'),
          code: form.get('code'),
          sampleType: form.get('sampleType'),
          referenceRange: form.get('referenceRange') || undefined,
          unit: form.get('unit') || undefined,
          turnaroundHours: form.get('turnaroundHours') ? Number(form.get('turnaroundHours')) : undefined,
          criticalLow: form.get('criticalLow') ? Number(form.get('criticalLow')) : undefined,
          criticalHigh: form.get('criticalHigh') ? Number(form.get('criticalHigh')) : undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Test added', 'Laboratory test saved.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['lab-tests'] })
    },
  })

  const saveSell = useMutation({
    mutationFn: ({ code, sell }: { code: string; sell: number }) =>
      apiRequest(`/laboratory/catalog/tests/${encodeURIComponent(code)}/pricing`, {
        method: 'PATCH',
        body: JSON.stringify({ sell }),
      }),
    onSuccess: async () => {
      notify('Lab price saved', 'Cashier and walk-in desk now use this amount.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['lab-catalog-tests'] })
      await queryClient.invalidateQueries({ queryKey: ['clinical-order-catalog-tests'] })
    },
    onError: (error: Error) => notify('Could not save price', error.message, 'critical'),
  })

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Bulk import (onboarding)"
          description="Upload a CSV to create panels and tests in one step. Download the template, fill your hospital catalog, then import."
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const link = document.createElement('a')
              link.href = '/templates/lab-catalog-import-template.csv'
              link.download = 'lab-catalog-import-template.csv'
              link.click()
            }}
          >
            <Download className="h-4 w-4" />
            Download CSV template
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            {importCatalog.isPending ? 'Importing…' : 'Upload CSV / Excel'}
            <input
              type="file"
              accept={SPREADSHEET_UPLOAD_ACCEPT}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  importCatalog.mutate(await readSpreadsheetAsCsv(file))
                } catch (error) {
                  notify(
                    'Import failed',
                    error instanceof Error ? error.message : 'Could not read that spreadsheet.',
                    'critical',
                  )
                }
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Columns: record_type (panel|test), panel_code, name, code, category, sample_type, reference_range,
          unit, turnaround_hours, critical_low, critical_high, description
        </p>
        {importSummary ? <Alert tone="info" className="mt-4">{importSummary}</Alert> : null}
      </Card>

      <Card className="p-6">
        <PageHeader
          title="LIS orderable catalog import"
          description="Bulk import into the production Kenya LIS catalog (orderable tests, lab sections, specimens, parameters)."
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const link = document.createElement('a')
              link.href = '/templates/lis-orderable-catalog-import-template.csv'
              link.download = 'lis-orderable-catalog-import-template.csv'
              link.click()
            }}
          >
            <Download className="h-4 w-4" />
            Download LIS CSV template
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            {importLisCatalog.isPending ? 'Importing…' : 'Upload LIS CSV / Excel'}
            <input
              type="file"
              accept={SPREADSHEET_UPLOAD_ACCEPT}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  importLisCatalog.mutate(await readSpreadsheetAsCsv(file))
                } catch (error) {
                  notify(
                    'Import failed',
                    error instanceof Error ? error.message : 'Could not read that spreadsheet.',
                    'critical',
                  )
                }
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Columns: code, name, department_code, specimen_code, is_panel, tat_minutes, parameter_code,
          parameter_name, unit, ref_low, ref_high, sell (or rate / price)
        </p>
        {lisImportSummary ? <Alert tone="info" className="mt-4">{lisImportSummary}</Alert> : null}
      </Card>

      <Card className="p-6">
        <PageHeader
          title="Bulk sell prices"
          description="Upload the hospital price list against the existing 192 orderable tests. Matched rows save a sell price. Unmatched rows are reported and not created."
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadTextFile('lab-price-import-template.csv', '/templates/lab-price-import-template.csv')}
          >
            <Download className="h-4 w-4" />
            Download blank format
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              downloadTextFile('jalaram-lab-price-list.csv', '/templates/jalaram-lab-price-list.csv')
            }
          >
            <Download className="h-4 w-4" />
            Download Jalaram price list
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!catalogTests.length}
            onClick={() => {
              const rows = ['code,name,sell', ...catalogTests.map((test) =>
                [csvCell(test.code), csvCell(test.name), csvCell(test.sell ?? '')].join(','),
              )]
              downloadGeneratedCsv('lab-catalog-current-prices.csv', rows.join('\n'))
            }}
          >
            <Download className="h-4 w-4" />
            Download current catalog
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            {importPrices.isPending ? 'Importing…' : 'Upload price CSV / Excel'}
            <input
              type="file"
              accept={SPREADSHEET_UPLOAD_ACCEPT}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  const csv = await readSpreadsheetAsCsv(file, ['Pathology_Import', 'Pathology_Review'])
                  const seen = new Set<string>()
                  const rows = parseSimpleCsv(csv).map((row) => {
                    const code = (row.code ?? row.test_code ?? '').trim()
                    const name = (row.name ?? row.test ?? row.test_name ?? '').trim()
                    const sell = (row.sell ?? row.price ?? row.rate ?? '').trim()
                    const classified = classifyAgainstCatalog({ code, name }, catalogTests, seen)
                    return {
                      code,
                      name,
                      sell,
                      kind: !sell || Number(sell) <= 0 ? 'NO PRICE' : classified.kind,
                      match: classified.matchCodes.join(', '),
                    }
                  })
                  setPricePreview({ csv, rows })
                  setPriceImportSummary(
                    `${rows.length} source rows · ${rows.filter((r) => r.kind === 'EXISTING MATCH').length} existing · ${rows.filter((r) => r.kind === 'NEW').length} new · ${rows.filter((r) => r.kind === 'AMBIGUOUS').length} ambiguous · ${rows.filter((r) => r.kind === 'NO PRICE').length} no price. Confirm to save matched prices only.`,
                  )
                } catch (error) {
                  notify(
                    'Price import failed',
                    error instanceof Error ? error.message : 'Could not read that spreadsheet.',
                    'critical',
                  )
                }
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Format: code, name, sell. Use the catalog code when you have it. Name matching is a fallback. RATE / PRICE / KES / KSH also work. The Jalaram list maps the hospital sheet to existing codes; seven name-only rows stay unmatched until those tests exist in the catalog.
        </p>
        {priceImportSummary ? <Alert tone="info" className="mt-4">{priceImportSummary}</Alert> : null}
        {pricePreview ? (
          <div className="mt-4 space-y-3">
            <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Sell</th>
                    <th className="px-3 py-2">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {pricePreview.rows.slice(0, 80).map((row, index) => (
                    <tr key={`${row.code}-${row.name}-${index}`} className="border-b border-slate-100">
                      <td className="px-3 py-1.5 font-medium">{row.kind}</td>
                      <td className="px-3 py-1.5">{row.name}</td>
                      <td className="px-3 py-1.5 font-mono">{row.code || '—'}</td>
                      <td className="px-3 py-1.5">{row.sell || 'NO PRICE'}</td>
                      <td className="px-3 py-1.5">{row.match || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `Save sell prices for existing matches only? New and ambiguous rows will stay unmatched. Existing 55 priced tests are updated only where this file has a code/name match.`,
                    )
                  ) {
                    importPrices.mutate(pricePreview.csv)
                    setPricePreview(null)
                  }
                }}
              >
                Confirm matched prices
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPricePreview(null)}>
                Cancel preview
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="p-8">
        <PageHeader
          title="LIS catalog (Kenya / Jalaram)"
          description="Production orderable tests and panels with SI units, specimen types, lab sections, and stratified reference ranges."
        />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Lab sections ({departments.length})
            </h3>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {departments.map((department) => (
                <li key={department.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <p className="font-semibold">{department.name}</p>
                  <p className="text-xs text-slate-500">{department.code}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Panels ({catalogPanels.length})
            </h3>
            {catalogLoading ? (
              <div className="mt-3 h-24 animate-skeleton rounded-xl" />
            ) : (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {catalogPanels.slice(0, 20).map((panel) => (
                  <li key={panel.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <p className="font-semibold">{panel.name}</p>
                    <p className="text-xs text-slate-500">
                      {panel.code}
                      {panel.standardTatMinutes ? ` · ${Math.round(panel.standardTatMinutes / 60)}h TAT` : ''}
                      {formatConfiguredPrice(panel.sell) ? ` · ${formatConfiguredPrice(panel.sell)}` : ' · No price configured'}
                    </p>
                  </li>
                ))}
                {catalogPanels.length > 20 ? (
                  <p className="text-xs text-slate-500">+ {catalogPanels.length - 20} more panels</p>
                ) : null}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Orderable tests ({catalogSingles.length})
            </h3>
            {catalogLoading ? (
              <div className="mt-3 h-24 animate-skeleton rounded-xl" />
            ) : (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {catalogSingles.slice(0, 20).map((test) => (
                  <li key={test.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <p className="font-semibold">{test.name}</p>
                    <p className="text-xs text-slate-500">
                      {test.code}
                      {test.department?.name ? ` · ${test.department.name}` : ''}
                      {formatConfiguredPrice(test.sell) ? ` · ${formatConfiguredPrice(test.sell)}` : ' · No price configured'}
                    </p>
                  </li>
                ))}
                {catalogSingles.length > 20 ? (
                  <p className="text-xs text-slate-500">+ {catalogSingles.length - 20} more tests</p>
                ) : null}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <PageHeader
          title="Sell prices"
          description="These are the exact amounts cashier and the walk-in lab desk use. Import a sell/rate column or edit a test here."
        />
        <input
          className="input mt-4"
          placeholder="Search catalog to set a price…"
          value={priceQuery}
          onChange={(e) => setPriceQuery(e.target.value)}
        />
        <div className="mt-4 max-h-80 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3">Test</th>
                <th className="pb-2 pr-3">Sell (KES)</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {catalogTests
                .filter((test) => {
                  const q = priceQuery.trim().toLowerCase()
                  if (!q) return true
                  return (
                    test.name.toLowerCase().includes(q) ||
                    test.code.toLowerCase().includes(q)
                  )
                })
                .slice(0, 80)
                .map((test) => (
                  <tr key={test.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-900">{test.name}</p>
                      <p className="text-xs text-slate-500">{test.code}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <Field
                        name={`sell-${test.code}`}
                        label=""
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-28"
                        value={priceDraft[test.code] ?? String(test.sell ?? 0)}
                        onChange={(e) =>
                          setPriceDraft((current) => ({ ...current, [test.code]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        loading={saveSell.isPending}
                        onClick={() =>
                          saveSell.mutate({
                            code: test.code,
                            sell: Number(priceDraft[test.code] ?? test.sell ?? 0) || 0,
                          })
                        }
                      >
                        Save
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-8">
        <PageHeader
          title="Legacy laboratory catalog"
          description="Older panel/test rows still supported for CSV import and backward-compatible workflows."
        />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Panels ({panels.length})</h3>
            {panelsLoading ? (
              <div className="mt-3 h-24 animate-skeleton rounded-xl" />
            ) : (
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {panels.map((panel) => (
                  <li key={panel.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <p className="font-semibold">{panel.name}</p>
                    <p className="text-xs text-slate-500">
                      {panel.code} · {panel.category}
                    </p>
                  </li>
                ))}
                {!panels.length ? <p className="text-sm text-slate-500">No panels configured.</p> : null}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Tests ({tests.length})</h3>
            {testsLoading ? (
              <div className="mt-3 h-24 animate-skeleton rounded-xl" />
            ) : (
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {tests.map((test) => (
                  <li key={test.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <p className="font-semibold">{test.name}</p>
                    <p className="text-xs text-slate-500">
                      {test.code}
                      {test.panel?.name ? ` · ${test.panel.name}` : ''}
                      {test.referenceRange ? ` · Ref ${test.referenceRange}` : ''}
                      {test.turnaroundHours ? ` · ${test.turnaroundHours}h TAT` : ''}
                    </p>
                  </li>
                ))}
                {!tests.length ? <p className="text-sm text-slate-500">No tests configured.</p> : null}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <PageHeader title="Add panel" description="Group related tests (e.g. Full Blood Count)." />
          <ClinicalForm className="mt-6" onSubmit={(e) => submitClinicalForm(createPanel, e)}>
            <FormSection title="Panel details" columns={1}>
              <Field name="name" label="Panel name" required />
              <Field name="code" label="Code" required placeholder="FBC" />
              <SelectField name="category" label="Category" required defaultValue="haematology">
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
              <Field name="description" label="Description" />
            </FormSection>
            {createPanel.error ? <Alert tone="error">{createPanel.error.message}</Alert> : null}
            <FormActions>
              <Button type="submit" loading={createPanel.isPending}>Save panel</Button>
            </FormActions>
          </ClinicalForm>
        </Card>

        <Card className="p-6">
          <PageHeader title="Add test" description="Individual analytes with reference ranges." />
          <ClinicalForm className="mt-6" onSubmit={(e) => submitClinicalForm(createTest, e)}>
            <FormSection title="Test details" columns={1}>
              <SelectField name="panelId" label="Panel (optional)">
                <option value="">Standalone test</option>
                {panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
              <Field name="name" label="Test name" required />
              <Field name="code" label="Code" required />
              <SelectField name="sampleType" label="Sample type" required defaultValue="whole_blood">
                {sampleTypes.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </SelectField>
              <Field name="referenceRange" label="Reference range" placeholder="e.g. 4.0-10.0" />
              <Field name="unit" label="Unit" placeholder="g/dL" />
              <Field name="turnaroundHours" label="Turnaround (hours)" type="number" />
              <Field name="criticalLow" label="Critical low" type="number" step="any" />
              <Field name="criticalHigh" label="Critical high" type="number" step="any" />
            </FormSection>
            {createTest.error ? <Alert tone="error">{createTest.error.message}</Alert> : null}
            <FormActions>
              <Button type="submit" loading={createTest.isPending}>Save test</Button>
            </FormActions>
          </ClinicalForm>
        </Card>
      </div>
    </div>
  )
}
