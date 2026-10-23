import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Alert, Button, Card, PageHeader, Select } from '../ui'
import { apiRequest } from '../../lib/api'
import { useAuthStore } from '../../lib/auth-store'
import { notify } from '../../lib/notify'
import { readSpreadsheetAsCsv, SPREADSHEET_UPLOAD_ACCEPT } from '../../lib/spreadsheet-import'
import { StockTakeSessionPanel } from './StockTakeSessionPanel'

type Location = { id: string; name: string; code: string }
type Preview = {
  created: number
  updated: number
  skippedExisting?: number
  heldOpeningQty: number
  rejectedExpiredQty: number
  duplicates: string[]
  errors: string[]
  unresolved?: string[]
  intent?: string
  totals?: {
    matched: number
    unresolved: number
    positiveAdjustments: number
    negativeAdjustments: number
    unchanged: number
    grossPositiveQty: number
    grossNegativeQty: number
    netQty: number
    netValue: number
  }
  rows?: Array<{
    line: number
    sku: string
    name: string
    action: string
    systemQty: number | null
    countedQty: number | null
    varianceQty: number | null
    staleSnapshot: boolean
  }>
}

const EXPECTED_COLUMNS = [
  { sheet: 'NAME OF THE ITEM', mapsTo: 'Product name' },
  { sheet: 'RATE', mapsTo: 'Selling price' },
  { sheet: 'QTY', mapsTo: 'Counted quantity (held until confirmed)' },
  { sheet: 'BATCH NO.', mapsTo: 'Batch' },
  { sheet: 'EXPIRY', mapsTo: 'Expiry date' },
]

export function StockTakeWorkspace() {
  const queryClient = useQueryClient()
  const [locationId, setLocationId] = useState('')
  const [fileName, setFileName] = useState('')
  const [pendingCsv, setPendingCsv] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [sessionId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `take-${Date.now()}`,
  )

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })

  const detectedHeaders = useMemo(() => {
    if (!pendingCsv) return []
    return pendingCsv.split(/\r?\n/, 1)[0]?.split(',').map((h) => h.trim()) ?? []
  }, [pendingCsv])

  const previewCsv = useMutation({
    mutationFn: (csv: string) =>
      apiRequest<Preview>('/inventory/items/import/preview', {
        method: 'POST',
        body: JSON.stringify({
          csv,
          locationId: locationId || undefined,
          importIntent: 'stock_take',
          sessionId,
        }),
      }),
    onSuccess: (summary, csv) => {
      setPendingCsv(csv)
      setPreview(summary)
      notify(
        'Stock-take preview ready',
        `${summary.created} new · ${summary.updated} matched · ${summary.heldOpeningQty} counts held. Review before posting.`,
        summary.errors.length || summary.duplicates.length ? 'warning' : 'success',
      )
    },
    onError: (error: Error) => notify('Preview failed', error.message, 'critical'),
  })

  const importCsv = useMutation({
    mutationFn: ({
      csv,
      confirmStockTake,
      updateExisting,
    }: {
      csv: string
      confirmStockTake: boolean
      updateExisting?: boolean
    }) =>
      apiRequest<{
        created: number
        updated: number
        received: number
        priced: number
        heldOpeningQty: number
        skippedExisting?: number
        errors: string[]
      }>('/inventory/items/import', {
        method: 'POST',
        body: JSON.stringify({
          csv,
          locationId: locationId || undefined,
          confirmStockTake,
          updateExisting,
          importIntent: confirmStockTake ? 'stock_take' : 'catalogue',
          sessionId,
        }),
      }),
    onSuccess: async (summary) => {
      notify(
        summary.received ? 'Stock-take posted' : 'Catalogue updated only',
        `${summary.created} new · ${summary.updated} updated · ${summary.received} received · ${summary.priced} priced · ${summary.heldOpeningQty} counts still held.`,
        summary.errors.length ? 'warning' : 'success',
      )
      if (summary.errors.length) {
        notify('Some rows failed', summary.errors.slice(0, 4).join(' · '), 'critical')
      }
      setPendingCsv(null)
      setPreview(null)
      setFileName('')
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
    },
    onError: (error: Error) => notify('Import failed', error.message, 'critical'),
  })

  return (
    <div className="space-y-6">
      <StockTakeSessionPanel />
      <Card className="p-6">
        <PageHeader
          title="Sheet import (optional)"
          description="Preview catalogue mapping only. Stock-take posting from CSV is disabled. Import physical_count into an open session; a different authorised user must approve."
        />
        <ol className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {['New', 'Import', 'Validate', preview ? 'Preview' : 'Awaiting file', preview ? 'Confirm' : 'Not posted'].map(
            (step) => (
              <li key={step} className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {step}
              </li>
            ),
          )}
        </ol>
        <Alert tone="warning" className="mt-4">
          Download the current stock sheet, count physical stock, then import. Posting writes ledger
          adjustments (counted minus system quantity). It does not receive counted quantity as new stock.
          Catalogue-only import never moves stock. Valuation uses unit cost, not selling price.
        </Alert>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3">Sheet column</th>
                <th className="pb-2">Maps to</th>
              </tr>
            </thead>
            <tbody>
              {EXPECTED_COLUMNS.map((col) => (
                <tr key={col.sheet} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium">{col.sheet}</td>
                  <td className="py-2 text-slate-600">{col.mapsTo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="font-medium text-slate-700">Count location</span>
            <Select className="mt-1 min-w-[14rem]" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Auto (pharmacy / main store)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const link = document.createElement('a')
              link.href = '/templates/jalaram-stock-take-import-template.csv'
              link.download = 'jalaram-stock-take-import-template.csv'
              link.click()
            }}
          >
            Download empty template
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const { accessToken, tenant } = useAuthStore.getState()
              const query = locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''
              const response = await fetch(`/api/v1/inventory/stock-sheet${query}`, {
                headers: {
                  Authorization: accessToken ? `Bearer ${accessToken}` : '',
                  'X-Tenant': tenant,
                },
                credentials: 'include',
              })
              if (!response.ok) {
                notify('Could not download stock sheet', 'Check inventory access and try again.', 'critical')
                return
              }
              const blob = await response.blob()
              const link = document.createElement('a')
              link.href = URL.createObjectURL(blob)
              link.download = `current-stock-sheet.csv`
              link.click()
              URL.revokeObjectURL(link.href)
            }}
          >
            Download current stock sheet
          </Button>
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Import stock-take sheet
            <input
              type="file"
              accept={SPREADSHEET_UPLOAD_ACCEPT}
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                try {
                  setFileName(file.name)
                  previewCsv.mutate(await readSpreadsheetAsCsv(file, ['Pharmacy_Import', 'Pharmacy_Review']))
                } catch (error) {
                  notify(
                    'Could not read file',
                    error instanceof Error ? error.message : 'Use CSV or Excel (.xlsx).',
                    'critical',
                  )
                }
              }}
            />
          </label>
        </div>
        {fileName ? <p className="mt-2 text-xs text-slate-500">File: {fileName}</p> : null}
        {previewCsv.isPending ? <p className="mt-3 text-sm text-slate-500">Validating sheet…</p> : null}
      </Card>

      {preview && pendingCsv ? (
        <Card className="p-6">
          <PageHeader title="Review before posting" description="Counts are not applied until you confirm." />
          {detectedHeaders.length ? (
            <p className="mt-3 text-xs text-slate-500">Detected headers: {detectedHeaders.join(' · ')}</p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Exact matches" value={preview.updated} />
            <Stat label="New products" value={preview.created} />
            <Stat label="Existing left unchanged" value={preview.skippedExisting ?? 0} />
            <Stat label="Counts held until confirm" value={preview.heldOpeningQty} />
            <Stat label="Expired lots rejected" value={preview.rejectedExpiredQty} tone="rose" />
            <Stat label="Positive variance qty" value={preview.totals?.grossPositiveQty ?? 0} />
            <Stat label="Negative variance qty" value={preview.totals?.grossNegativeQty ?? 0} tone="rose" />
            <Stat label="Net qty" value={preview.totals?.netQty ?? 0} />
          </div>

          {preview.duplicates.length ? (
            <Alert tone="error" className="mt-4">
              <span className="font-semibold">Duplicate / ambiguous rows. </span>
              {preview.duplicates.slice(0, 6).join(' · ')}
            </Alert>
          ) : null}
          {preview.errors.length ? (
            <Alert tone="warning" className="mt-4">
              <span className="font-semibold">Warnings. </span>
              {preview.errors.slice(0, 8).join(' · ')}
            </Alert>
          ) : null}
          {preview.unresolved?.length ? (
            <Alert tone="warning" className="mt-4">
              <span className="font-semibold">Likely matches not applied. </span>
              {preview.unresolved.slice(0, 8).join(' · ')}
            </Alert>
          ) : null}
          {preview.rejectedExpiredQty ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-rose-800">
              <AlertTriangle className="h-4 w-4" />
              Expired opening lots will not be received.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={importCsv.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Create ${preview.created} new catalogue rows only? Existing products, prices, and batches will not be overwritten. Counted quantities stay held.`,
                  )
                ) {
                  importCsv.mutate({ csv: pendingCsv, confirmStockTake: false })
                }
              }}
            >
              Create new products only
            </Button>
            <Alert tone="info">
              Confirm-and-post from this sheet is disabled. Use the session above: download the physical
              count sheet, enter physical_count (not book_qty), import counts, then a different authorised
              user approves.
            </Alert>
          </div>
        </Card>
      ) : (
        <p className="text-sm text-slate-500">No stock-take sheet loaded. Import the Excel/CSV to preview.</p>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'rose' }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone === 'rose' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
