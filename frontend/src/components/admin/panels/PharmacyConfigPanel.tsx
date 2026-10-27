import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Field, PageHeader, SelectField } from '../../ui'
import { apiRequest, formatApiError } from '../../../lib/api'
import { notify } from '../../../lib/notify'
import { useAuthStore } from '../../../lib/auth-store'
import { formatConfiguredPrice } from '../../../lib/clinical-catalog'
import { drugClassLabel } from '../../../lib/drug-class'
import { readSpreadsheetAsCsv, SPREADSHEET_UPLOAD_ACCEPT } from '../../../lib/spreadsheet-import'
import { WorkspaceTabs } from '../../ui/WorkspaceTabs'
import { InventoryPricesPanel } from '../../inventory/InventoryPricesPanel'
import { StockTakeWorkspace } from '../../inventory/StockTakeWorkspace'
import { StockControlPanel, StockReportsPanel, StockStoresPanel } from '../StockOversightPanels'
import { DepartmentExportsPanel } from '../../reports/DepartmentExportsPanel'
import { dispatchHospitalNavigate } from '../../../lib/navigate'

type ConfigTab = 'catalogue' | 'stores' | 'stocktake' | 'batch' | 'rules' | 'reports'

type CatalogueItem = {
  id: string
  sku: string
  name: string
  category: 'pharmaceutical' | 'medical_consumable' | 'non_medical'
  drugClass?: string | null
  unit: string
  strength?: string | null
  dosageForm?: string | null
  sell?: number
  cost?: number
  markup?: number
  active: boolean
  trackBatch: boolean
  minLevel?: number | null
  maxLevel?: number | null
  formularyStatusLabel?: string
  prescribingStatusLabel?: string
  regulatoryStatusLabel?: string
  ppbRegistrationNo?: string | null
}

type ImportPreviewSummary = {
  preview: boolean
  intent: string
  sessionId: string | null
  stockTakeApplied: boolean
  receiptApplied: boolean
  updateExisting: boolean
  created: number
  updated: number
  skippedExisting: number
  received: number
  priced: number
  heldOpeningQty: number
  rejectedExpiredQty: number
  duplicates: string[]
  errors: string[]
  unresolved: string[]
  rows: Array<{
    line: number
    sku: string
    name: string
    match: string
    action: string
    status: 'validated' | 'applied' | 'rejected' | 'failed'
    existingSku?: string
    existingName?: string
    systemQty: number | null
    countedQty: number | null
  }>
}

type Location = { id: string; name: string; code: string; locationType: string }

function downloadCsvFile(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
  URL.revokeObjectURL(href)
}

export function PharmacyConfigPanel() {
  const [tab, setTab] = useState<ConfigTab>('catalogue')
  const permissions = useAuthStore((s) => s.user?.permissions ?? [])
  const canManage = permissions.includes('inventory:manage') || permissions.includes('settings:manage')
  const canExport = permissions.includes('pharmacy:read') || permissions.includes('reports:read')

  const openInventoryStore = () => {
    dispatchHospitalNavigate('Inventory & Store')
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Pharmacy Configuration"
            description="Single Hospital Control Center desk for catalogue & bulk import, stores & opening stock, stock-take reconciliation, batches & expiry, rules & approvals, and reports & audit."
          />
          <Button type="button" variant="secondary" onClick={openInventoryStore}>
            Open Inventory & Store
          </Button>
        </div>
        <div className="mt-4">
          <WorkspaceTabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'catalogue', label: '1. Catalogue & Bulk Import' },
              { id: 'stores', label: '2. Stores & Opening Stock' },
              { id: 'stocktake', label: '3. Stock-Take & Reconciliation' },
              { id: 'batch', label: '4. Batches & Expiry' },
              { id: 'rules', label: '5. Rules & Approvals' },
              { id: 'reports', label: '6. Reports & Audit' },
            ]}
          />
        </div>
      </Card>

      {tab === 'catalogue' ? <PharmacyCatalogueSection canManage={canManage} /> : null}
      {tab === 'stores' ? <StoresAndOpeningStockSection canManage={canManage} /> : null}
      {tab === 'stocktake' ? <StockTakeWorkspace /> : null}
      {tab === 'batch' ? <StockControlPanel /> : null}
      {tab === 'rules' ? <PharmacyRulesSection canManage={canManage} /> : null}
      {tab === 'reports' ? (
        <div className="space-y-6">
          <StockReportsPanel />
          {canExport ? <DepartmentExportsPanel initialDataset="pharmacy" /> : null}
        </div>
      ) : null}
    </div>
  )
}

function PharmacyCatalogueSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('tablet')
  const [strength, setStrength] = useState('')
  const [dosageForm, setDosageForm] = useState('')
  const [minLevel, setMinLevel] = useState('10')

  // Bulk Catalogue Import state
  const [csvText, setCsvText] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [updateExisting, setUpdateExisting] = useState(false)
  const [preview, setPreview] = useState<ImportPreviewSummary | null>(null)
  const [appliedSummary, setAppliedSummary] = useState<ImportPreviewSummary | null>(null)

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['inventory-items', 'include-inactive'],
    queryFn: () => apiRequest<CatalogueItem[]>('/inventory/items?includeInactive=true'),
  })

  const createItem = useMutation({
    mutationFn: () =>
      apiRequest('/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          category: 'pharmaceutical',
          unit: unit.trim() || 'tablet',
          strength: strength.trim() || undefined,
          dosageForm: dosageForm.trim() || undefined,
          trackBatch: true,
          minLevel: minLevel.trim() ? Number(minLevel) : undefined,
        }),
      }),
    onSuccess: async () => {
      notify('Catalogue product added', 'SKU saved to demo.inventory_items.', 'success')
      setSku('')
      setName('')
      setStrength('')
      setDosageForm('')
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      await queryClient.invalidateQueries({ queryKey: ['pharmacy-stock-table'] })
    },
    onError: (err: Error) => notify('Could not add product', formatApiError(err, err.message), 'critical'),
  })

  const updateItem = useMutation({
    mutationFn: (input: {
      id: string
      strength?: string
      dosageForm?: string
      active?: boolean
      minLevel?: number
    }) =>
      apiRequest(`/inventory/items/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          strength: input.strength,
          dosageForm: input.dosageForm,
          active: input.active,
          minLevel: input.minLevel,
        }),
      }),
    onSuccess: async () => {
      notify('Product updated', 'Catalogue record saved.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      await queryClient.invalidateQueries({ queryKey: ['pharmacy-stock-table'] })
    },
    onError: (err: Error) => notify('Update failed', formatApiError(err, err.message), 'critical'),
  })

  const runPreview = useMutation({
    mutationFn: (input: { csv: string; updateExisting: boolean }) =>
      apiRequest<ImportPreviewSummary>('/inventory/items/import/preview', {
        method: 'POST',
        body: JSON.stringify({
          csv: input.csv,
          importIntent: 'catalogue',
          confirmStockTake: false,
          updateExisting: input.updateExisting,
        }),
      }),
    onSuccess: (summary, vars) => {
      setCsvText(vars.csv)
      setPreview(summary)
      setAppliedSummary(null)
      notify(
        'Dry-run preview ready',
        `${summary.created} new · ${summary.updated} matched · ${summary.errors.length} validation errors. Catalogue import never changes on-hand stock.`,
        summary.errors.length || summary.duplicates.length ? 'warning' : 'success',
      )
    },
    onError: (err: Error) => notify('Preview failed', formatApiError(err, err.message), 'critical'),
  })

  const applyCatalogueImport = useMutation({
    mutationFn: () => {
      if (!csvText) throw new Error('Load and preview a CSV/XLSX file first.')
      return apiRequest<ImportPreviewSummary>('/inventory/items/import', {
        method: 'POST',
        body: JSON.stringify({
          csv: csvText,
          importIntent: 'catalogue',
          confirmStockTake: false,
          updateExisting,
        }),
      })
    },
    onSuccess: async (summary) => {
      setAppliedSummary(summary)
      setPreview(null)
      setCsvText(null)
      notify(
        'Catalogue import committed',
        `${summary.created} created · ${summary.updated} updated · ${summary.skippedExisting} skipped · ${summary.priced} priced. On-hand stock was not touched.`,
        summary.errors.length ? 'warning' : 'success',
      )
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      await queryClient.invalidateQueries({ queryKey: ['pharmacy-stock-table'] })
    },
    onError: (err: Error) => notify('Catalogue import failed', formatApiError(err, err.message), 'critical'),
  })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.drugClass ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, query])

  const activeReport = preview ?? appliedSummary

  const downloadErrorReport = () => {
    if (!activeReport) return
    const lines = [
      'type,message',
      ...activeReport.errors.map((m) => `validation_error,"${m.replace(/"/g, '""')}"`),
      ...activeReport.duplicates.map((m) => `duplicate,"${m.replace(/"/g, '""')}"`),
      ...activeReport.unresolved.map((m) => `unresolved_match,"${m.replace(/"/g, '""')}"`),
    ]
    downloadCsvFile('pharmacy-catalogue-import-errors.csv', `${lines.join('\n')}\n`)
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Pharmacy Catalogue Bulk Importer (CSV / XLSX)"
          description="Dry-run preview before confirmation. Creates or updates products and selling prices in demo.inventory_items. Any quantity columns are held and never change on-hand stock here — use Tab 2 (Stores & Opening Stock) for controlled opening stock receipts."
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              downloadCsvFile(
                'afyasasa-pharmacy-catalogue-template.csv',
                'sku,name,generic_name,strength,dosage_form,unit,category,sell,reorder_level\nPARA500,Paracetamol 500mg tablet,Paracetamol,500mg,tablet,tablet,pharmaceutical,5,20\nAMOX500,Amoxicillin 500mg capsule,Amoxicillin,500mg,capsule,capsule,pharmaceutical,15,15\n',
              )
            }
          >
            Download Catalogue Template (CSV)
          </Button>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={updateExisting}
              disabled={!canManage}
              onChange={(e) => {
                const next = e.target.checked
                setUpdateExisting(next)
                if (csvText) runPreview.mutate({ csv: csvText, updateExisting: next })
              }}
            />
            Update existing matched SKU / product records
          </label>

          {canManage ? (
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              Upload CSV / Excel for Dry-Run Preview
              <input
                type="file"
                accept={SPREADSHEET_UPLOAD_ACCEPT}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  try {
                    setFileName(file.name)
                    const csv = await readSpreadsheetAsCsv(file)
                    runPreview.mutate({ csv, updateExisting })
                  } catch (err) {
                    notify(
                      'Could not read file',
                      err instanceof Error ? err.message : 'Upload a valid CSV or XLSX file.',
                      'critical',
                    )
                  }
                }}
              />
            </label>
          ) : null}
        </div>

        {fileName ? <p className="mt-2 text-xs text-slate-500">Loaded file: {fileName}</p> : null}

        {activeReport ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {activeReport.preview ? 'Dry-Run Preview Summary (Not Yet Applied)' : 'Committed Import Summary'}
              </p>
              {activeReport.errors.length + activeReport.duplicates.length + activeReport.unresolved.length > 0 ? (
                <Button type="button" variant="secondary" onClick={downloadErrorReport}>
                  Download Error / Warning Report (CSV)
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
              <StatTile label="New Products" value={activeReport.created} />
              <StatTile label="Matched / Updated" value={activeReport.updated} />
              <StatTile label="Skipped Existing" value={activeReport.skippedExisting} />
              <StatTile label="Prices Configured" value={activeReport.priced} />
              <StatTile label="Opening Qty Held" value={activeReport.heldOpeningQty} />
              <StatTile
                label="Errors / Duplicates"
                value={activeReport.errors.length + activeReport.duplicates.length}
              />
            </div>

            {activeReport.errors.length ? (
              <Alert tone="error">
                <strong>Validation errors ({activeReport.errors.length}):</strong>{' '}
                {activeReport.errors.slice(0, 6).join(' · ')}
              </Alert>
            ) : null}
            {activeReport.duplicates.length ? (
              <Alert tone="warning">
                <strong>Duplicates ({activeReport.duplicates.length}):</strong>{' '}
                {activeReport.duplicates.slice(0, 6).join(' · ')}
              </Alert>
            ) : null}
            {activeReport.unresolved.length ? (
              <Alert tone="warning">
                <strong>Ambiguous / likely matches held ({activeReport.unresolved.length}):</strong>{' '}
                {activeReport.unresolved.slice(0, 6).join(' · ')}
              </Alert>
            ) : null}

            {activeReport.rows.length ? (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 uppercase text-slate-500">
                      <th className="p-2">Line</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2">Product</th>
                      <th className="p-2">Match</th>
                      <th className="p-2">Action</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReport.rows.slice(0, 50).map((r) => (
                      <tr key={r.line} className="border-b border-slate-100">
                        <td className="p-2 tabular-nums">{r.line}</td>
                        <td className="p-2 font-mono">{r.sku}</td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.match}</td>
                        <td className="p-2">{r.action}</td>
                        <td className="p-2 font-semibold">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {preview && canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  loading={applyCatalogueImport.isPending}
                  onClick={() => applyCatalogueImport.mutate()}
                >
                  Confirm & Apply Catalogue Import (No Stock Change)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPreview(null)
                    setCsvText(null)
                  }}
                >
                  Cancel Preview
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {!canManage ? (
        <Alert tone="info">
          Read-only view. Adding products, changing active state, or updating prices requires{' '}
          <code>inventory:manage</code>.
        </Alert>
      ) : (
        <Card className="p-6">
          <PageHeader
            title="Add Single Pharmaceutical Product"
            description="Creates a hospital formulary record in demo.inventory_items. Batch tracking is enforced for pharmaceuticals. Adding a product enables prescribing in AfyaSasa; it does not record or imply PPB registration."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Field name="sku" label="SKU / Code" value={sku} onChange={(e) => setSku(e.target.value)} />
            <Field name="name" label="Product Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field name="strength" label="Strength (e.g. 500mg)" value={strength} onChange={(e) => setStrength(e.target.value)} />
            <Field name="dosageForm" label="Dosage Form" value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} />
            <SelectField name="unit" label="Base Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="tablet">tablet</option>
              <option value="capsule">capsule</option>
              <option value="bottle">bottle</option>
              <option value="ampoule">ampoule</option>
              <option value="vial">vial</option>
              <option value="tube">tube</option>
              <option value="unit">unit</option>
            </SelectField>
            <Field
              name="minLevel"
              label="Reorder Level"
              type="number"
              min={0}
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              type="button"
              disabled={!sku.trim() || !name.trim() || createItem.isPending}
              loading={createItem.isPending}
              onClick={() => createItem.mutate()}
            >
              Add product to catalogue
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <PageHeader
          title="Hospital Formulary & Inventory Catalogue"
          description="Authoritative product master (demo.inventory_items). Hospital formulary and prescribing availability are separate from Pharmacy and Poisons Board (PPB) registration, which is shown only when verified evidence is recorded."
        />
        <input
          className="input mt-4 max-w-md"
          placeholder="Search product name, SKU, or therapeutic class…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {error ? (
          <Alert tone="error" className="mt-4">
            {formatApiError(error, 'Could not load catalogue.')}
          </Alert>
        ) : null}
        {isLoading ? (
          <div className="mt-6 h-40 animate-skeleton rounded-xl" />
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3">Product</th>
                  <th className="pb-2 pr-3">SKU</th>
                  <th className="pb-2 pr-3">Class</th>
                  <th className="pb-2 pr-3">Strength</th>
                  <th className="pb-2 pr-3">Dosage Form</th>
                  <th className="pb-2 pr-3">Sell Price</th>
                  <th className="pb-2 pr-3">Reorder</th>
                  <th className="pb-2 pr-3">Formulary / prescribing</th>
                  <th className="pb-2">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <CatalogueRow
                    key={item.id}
                    item={item}
                    canManage={canManage}
                    onSave={(patch) => updateItem.mutate({ id: item.id, ...patch })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canManage ? <InventoryPricesPanel /> : null}
    </div>
  )
}

function StoresAndOpeningStockSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const [locationId, setLocationId] = useState('')
  const [sessionId, setSessionId] = useState(() => `open-${Date.now()}`)
  const [csvText, setCsvText] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreviewSummary | null>(null)

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations', 'opening-stock'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })

  const previewOpening = useMutation({
    mutationFn: (csv: string) =>
      apiRequest<ImportPreviewSummary>('/inventory/items/import/preview', {
        method: 'POST',
        body: JSON.stringify({
          csv,
          locationId: locationId || undefined,
          importIntent: 'receipt',
          confirmStockTake: false,
          sessionId,
        }),
      }),
    onSuccess: (summary, csv) => {
      setCsvText(csv)
      setPreview(summary)
      notify(
        'Opening-stock dry-run ready',
        `${summary.heldOpeningQty} valid batch receipts previewed · ${summary.rejectedExpiredQty} expired rejected.`,
        summary.errors.length ? 'warning' : 'success',
      )
    },
    onError: (err: Error) => notify('Opening-stock preview failed', formatApiError(err, err.message), 'critical'),
  })

  const postOpening = useMutation({
    mutationFn: () => {
      if (!csvText || !locationId) throw new Error('Select a destination store and preview the sheet first.')
      return apiRequest<ImportPreviewSummary>('/inventory/items/import', {
        method: 'POST',
        body: JSON.stringify({
          csv: csvText,
          locationId,
          importIntent: 'receipt',
          confirmStockTake: true,
          sessionId,
        }),
      })
    },
    onSuccess: async (summary) => {
      notify(
        'Opening stock received',
        `${summary.received} batch receipt(s) written to demo.inventory_transactions (session ${sessionId}).`,
        'success',
      )
      setPreview(null)
      setCsvText(null)
      setSessionId(`open-${Date.now()}`)
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
      await queryClient.invalidateQueries({ queryKey: ['pharmacy-stock-table'] })
      await queryClient.invalidateQueries({ queryKey: ['pharmacy-dashboard'] })
    },
    onError: (err: Error) => notify('Opening stock failed', formatApiError(err, err.message), 'critical'),
  })

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Controlled Opening-Stock Receipt Workflow"
          description="Separate from catalogue import and physical stock-take. Posts RECEIPT ledger entries (referenceType=receipt_import) with idempotent sessionId protection and batch/expiry validation."
        />

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <SelectField
            name="openingLocation"
            label="Destination Store"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">Select store…</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </SelectField>
          <Field
            name="openingSessionId"
            label="Idempotency Session Key"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              downloadCsvFile(
                'afyasasa-opening-stock-template.csv',
                'sku,name,unit,category,batch_no,expiry_date,opening_qty,sell\nPARA500,Paracetamol 500mg tablet,tablet,pharmaceutical,BATCH-001,2028-12-31,100,5\n',
              )
            }
          >
            Download Opening-Stock Template
          </Button>
          {canManage ? (
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              Preview Opening-Stock Sheet
              <input
                type="file"
                accept={SPREADSHEET_UPLOAD_ACCEPT}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  const csv = await readSpreadsheetAsCsv(file)
                  previewOpening.mutate(csv)
                }}
              />
            </label>
          ) : null}
        </div>

        {preview ? (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold">
              Preview: {preview.heldOpeningQty} opening-stock lot(s) ready · {preview.rejectedExpiredQty} expired lot(s)
              rejected · {preview.errors.length} error(s)
            </p>
            {preview.errors.length ? (
              <Alert tone="warning">{preview.errors.slice(0, 6).join(' · ')}</Alert>
            ) : null}
            {canManage ? (
              <Button
                type="button"
                disabled={!locationId || postOpening.isPending}
                loading={postOpening.isPending}
                onClick={() => postOpening.mutate()}
              >
                Confirm & Post Controlled Opening Stock
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <StockStoresPanel />
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}

function CatalogueRow({
  item,
  canManage,
  onSave,
}: {
  item: CatalogueItem
  canManage: boolean
  onSave: (patch: { strength?: string; dosageForm?: string; active?: boolean; minLevel?: number }) => void
}) {
  const [strength, setStrength] = useState(item.strength ?? '')
  const [dosageForm, setDosageForm] = useState(item.dosageForm ?? '')
  const [minLevel, setMinLevel] = useState(item.minLevel != null ? String(item.minLevel) : '')

  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-3 font-medium">{item.name}</td>
      <td className="py-2 pr-3 font-mono text-xs">{item.sku}</td>
      <td className="py-2 pr-3 text-xs text-slate-600">{drugClassLabel(item.drugClass)}</td>
      <td className="py-2 pr-3">
        <input
          className="w-28 rounded border border-slate-200 px-2 py-1 text-xs"
          disabled={!canManage}
          value={strength}
          placeholder="—"
          onChange={(e) => setStrength(e.target.value)}
          onBlur={() => {
            if (canManage && strength !== (item.strength ?? '')) onSave({ strength })
          }}
        />
      </td>
      <td className="py-2 pr-3">
        <input
          className="w-28 rounded border border-slate-200 px-2 py-1 text-xs"
          disabled={!canManage}
          value={dosageForm}
          placeholder={item.unit}
          onChange={(e) => setDosageForm(e.target.value)}
          onBlur={() => {
            if (canManage && dosageForm !== (item.dosageForm ?? '')) onSave({ dosageForm })
          }}
        />
      </td>
      <td className="py-2 pr-3">
        {formatConfiguredPrice(item.sell) ?? <span className="text-xs text-amber-800">No price</span>}
      </td>
      <td className="py-2 pr-3">
        <input
          className="w-20 rounded border border-slate-200 px-2 py-1 text-xs tabular-nums"
          type="number"
          min={0}
          disabled={!canManage}
          value={minLevel}
          placeholder="10"
          onChange={(e) => setMinLevel(e.target.value)}
          onBlur={() => {
            if (!canManage) return
            const num = minLevel.trim() === '' ? undefined : Number(minLevel)
            if (num !== (item.minLevel ?? undefined)) onSave({ minLevel: num })
          }}
        />
      </td>
      <td className="py-2 pr-3 text-xs text-slate-700">
        <p>{item.formularyStatusLabel ?? (item.category === 'pharmaceutical' ? 'Hospital formulary' : 'Non-formulary supply item')}</p>
        <p className="text-slate-500">
          {item.prescribingStatusLabel ?? (item.active ? 'Available for prescribing' : 'Inactive in hospital formulary')}
        </p>
        <p className="text-slate-500">
          {item.regulatoryStatusLabel ??
            (item.ppbRegistrationNo
              ? `PPB registration verified (${item.ppbRegistrationNo})`
              : 'PPB regulatory registration not recorded')}
        </p>
      </td>
      <td className="py-2">
        {canManage ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSave({ active: !item.active })}
          >
            {item.active ? 'Enabled for prescribing' : 'Inactive in formulary'}
          </Button>
        ) : (
          <span className="text-xs">{item.active ? 'Enabled for prescribing' : 'Inactive in formulary'}</span>
        )}
      </td>
    </tr>
  )
}

function PharmacyRulesSection({ canManage }: { canManage: boolean }) {
  return (
    <Card className="space-y-4 p-6">
      <PageHeader
        title="Rules & Approvals"
        description="Enforced server-side across InventoryService and PaymentsService."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <h4 className="font-semibold text-slate-900">Stock-Take Segregation of Duties</h4>
          <p className="mt-1 text-slate-600">
            Physical count entry never updates live stock. Variance lines require a written explanation (≥3 characters).
            Submitting user (<code>submitted_by</code>) is blocked from approving their own count (
            <code>STOCK_TAKE_INDEPENDENT_APPROVAL</code>). CSV stock-take posting is disabled.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <h4 className="font-semibold text-slate-900">FEFO, Expiry & Reservation Holds</h4>
          <p className="mt-1 text-slate-600">
            Batch-tracked pharmaceuticals require batch number and expiry date on receipt. Expired batches are excluded
            from FEFO allocation and available stock. Preparing a prescription or OTC sale creates a hold in{' '}
            <code>demo.inventory_reservations</code> without reducing <code>qty_on_hand</code>.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <h4 className="font-semibold text-slate-900">Cashier Clearance & Credit</h4>
          <p className="mt-1 text-slate-600">
            Dispensing requires verified cashier payment or a documented credit approval by a different{' '}
            <code>payments:manage</code> user. Insurance and undocumented waivers fail closed.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <h4 className="font-semibold text-slate-900">Hospital Formulary vs PPB Registration</h4>
          <p className="mt-1 text-slate-600">
            Catalogue inclusion means the product is on the hospital formulary and, if active, available for
            prescribing in AfyaSasa. It never implies Pharmacy and Poisons Board registration. PPB status is shown
            only when a registration number is recorded and marked verified.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <h4 className="font-semibold text-slate-900">Reorder Levels & Expiry Warnings</h4>
          <p className="mt-1 text-slate-600">
            Minimum/maximum reorder levels are configured per product in the Catalogue & Bulk Import tab (
            {canManage ? 'editable with your account' : 'requires inventory:manage'}). Near-expiry alerts use a 90-day
            horizon.
          </p>
        </div>
      </div>
    </Card>
  )
}
