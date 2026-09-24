import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Alert, Button, Card, PageHeader, Select } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { readSpreadsheetAsCsv, SPREADSHEET_UPLOAD_ACCEPT } from '../../lib/spreadsheet-import'

type Location = { id: string; name: string; code: string }
type Preview = {
  created: number
  updated: number
  heldOpeningQty: number
  rejectedExpiredQty: number
  duplicates: string[]
  errors: string[]
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
        body: JSON.stringify({ csv, locationId: locationId || undefined }),
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
    mutationFn: ({ csv, confirmStockTake }: { csv: string; confirmStockTake: boolean }) =>
      apiRequest<{
        created: number
        updated: number
        received: number
        priced: number
        heldOpeningQty: number
        errors: string[]
      }>('/inventory/items/import', {
        method: 'POST',
        body: JSON.stringify({ csv, locationId: locationId || undefined, confirmStockTake }),
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
      <Card className="p-6">
        <PageHeader
          title="Stock take"
          description="Upload the hospital count sheet. Nothing changes live stock until you confirm a stock-take post."
        />
        <Alert tone="warning" className="mt-4">
          There is no draft/approval session in the backend yet. Preview validates the sheet. Posting
          with confirmation writes receipts for counted quantities. Do not post during an unsupervised count.
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
            <span className="font-medium text-slate-700">Receive counted qty into</span>
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
            Download sheet template
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
                  previewCsv.mutate(await readSpreadsheetAsCsv(file))
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

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Matched products" value={preview.updated} />
            <Stat label="New products" value={preview.created} />
            <Stat label="Counts held" value={preview.heldOpeningQty} />
            <Stat label="Expired lots rejected" value={preview.rejectedExpiredQty} tone="rose" />
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
                    `Update ${preview.created + preview.updated} catalogue rows and prices only? Counted quantities will stay held.`,
                  )
                ) {
                  importCsv.mutate({ csv: pendingCsv, confirmStockTake: false })
                }
              }}
            >
              Update products & prices only
            </Button>
            <Button
              type="button"
              loading={importCsv.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Post this stock take? This will receive counted quantities for ${preview.heldOpeningQty} rows into live stock at the selected location.`,
                  )
                ) {
                  importCsv.mutate({ csv: pendingCsv, confirmStockTake: true })
                }
              }}
            >
              Confirm and post counted stock
            </Button>
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
