import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, PageHeader, SelectField } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { formatConfiguredPrice } from '../../lib/clinical-catalog'
import { drugClassLabel } from '../../lib/drug-class'

type StockRow = {
  rowId: string
  itemId: string
  sku: string
  name: string
  genericName: string | null
  category: string
  drugClass: string | null
  strength: string | null
  dosageForm: string | null
  unit: string
  sell: number
  cost: number
  currency: string
  active: boolean
  trackBatch: boolean
  minLevel: number | null
  maxLevel: number | null
  locationId: string | null
  locationName: string | null
  batchId: string | null
  batchNo: string | null
  expiryDate: string | null
  expired: boolean
  onHand: number
  reserved: number
  available: number
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED' | 'INACTIVE'
}

type StockTableResponse = {
  selectedLocation: { id: string; name: string; code: string } | null
  locations: Array<{ id: string; name: string; code: string; locationType: string }>
  rows: StockRow[]
}

type SortField = 'name' | 'sku' | 'sell' | 'onHand' | 'available' | 'expiryDate'

export function PharmacyProductsStockPanel() {
  const [locationId, setLocationId] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ['pharmacy-stock-table', locationId],
    queryFn: () => {
      const qs = new URLSearchParams({ includeInactive: 'true' })
      if (locationId) qs.set('locationId', locationId)
      return apiRequest<StockTableResponse>(`/inventory/pharmacy-stock-table?${qs.toString()}`)
    },
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (data?.rows ?? []).filter((row) => {
      if (statusFilter && row.stockStatus !== statusFilter) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        (row.batchNo ?? '').toLowerCase().includes(q) ||
        (row.drugClass ?? '').toLowerCase().includes(q)
      )
    })

    return [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir
      if (sortBy === 'sku') return a.sku.localeCompare(b.sku) * dir
      if (sortBy === 'sell') return (a.sell - b.sell) * dir
      if (sortBy === 'onHand') return (a.onHand - b.onHand) * dir
      if (sortBy === 'available') return (a.available - b.available) * dir
      if (sortBy === 'expiryDate') {
        const ax = a.expiryDate ?? '9999-12-31'
        const bx = b.expiryDate ?? '9999-12-31'
        return ax.localeCompare(bx) * dir
      }
      return 0
    })
  }, [data?.rows, query, sortBy, sortDir, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  return (
    <Card className="p-6">
      <PageHeader
        title="Products & Stock"
        description={`Store scope: ${
          data?.selectedLocation?.name ?? 'PHARMACY'
        }. Each row represents a specific lot/batch at the selected store so batch expiry dates and held reservations are never merged across lots.`}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input
          className="input"
          placeholder="Search product, SKU, batch, class…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
          }}
        />
        <SelectField
          name="locationId"
          label=""
          value={locationId || data?.selectedLocation?.id || ''}
          onChange={(e) => {
            setLocationId(e.target.value)
            setPage(1)
          }}
        >
          {(data?.locations ?? []).map((loc) => (
            <option key={loc.id} value={loc.id}>
              Store: {loc.name} ({loc.code})
            </option>
          ))}
        </SelectField>
        <SelectField
          name="statusFilter"
          label=""
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All stock statuses</option>
          <option value="IN_STOCK">In stock</option>
          <option value="LOW_STOCK">Low stock</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
          <option value="EXPIRED">Expired lot</option>
          <option value="INACTIVE">Inactive product</option>
        </SelectField>
        <SelectField
          name="sortBy"
          label=""
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [f, d] = e.target.value.split(':') as [SortField, 'asc' | 'desc']
            setSortBy(f)
            setSortDir(d)
          }}
        >
          <option value="name:asc">Sort: Product name (A–Z)</option>
          <option value="name:desc">Sort: Product name (Z–A)</option>
          <option value="available:desc">Sort: Available qty (high–low)</option>
          <option value="available:asc">Sort: Available qty (low–high)</option>
          <option value="expiryDate:asc">Sort: Nearest expiry first</option>
          <option value="sell:asc">Sort: Selling price (low–high)</option>
        </SelectField>
      </div>

      {error ? (
        <Alert tone="error" className="mt-4">
          {formatApiError(error, 'Could not load catalogue and batch stock.')}
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="mt-6 h-48 animate-skeleton rounded-xl" />
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="cursor-pointer pb-2 pr-3" onClick={() => toggleSort('name')}>
                    Product / Class
                  </th>
                  <th className="pb-2 pr-3">Strength / Form</th>
                  <th className="cursor-pointer pb-2 pr-3" onClick={() => toggleSort('sku')}>
                    SKU
                  </th>
                  <th className="cursor-pointer pb-2 pr-3" onClick={() => toggleSort('sell')}>
                    Selling Price
                  </th>
                  <th className="pb-2 pr-3">Batch / Lot</th>
                  <th className="cursor-pointer pb-2 pr-3" onClick={() => toggleSort('expiryDate')}>
                    Expiry
                  </th>
                  <th className="cursor-pointer pb-2 pr-3 text-right" onClick={() => toggleSort('onHand')}>
                    On-Hand
                  </th>
                  <th className="pb-2 pr-3 text-right">Reserved</th>
                  <th className="cursor-pointer pb-2 pr-3 text-right" onClick={() => toggleSort('available')}>
                    Available
                  </th>
                  <th className="pb-2 pr-3 text-right">Reorder</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.rowId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">{drugClassLabel(row.drugClass)}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-700">
                      {[row.strength, row.dosageForm || row.unit].filter(Boolean).join(' · ') || row.unit}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{row.sku}</td>
                    <td className="py-2.5 pr-3">
                      {row.sell > 0 ? (
                        formatConfiguredPrice(row.sell)
                      ) : (
                        <span className="text-xs font-medium text-amber-800">No price</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{row.batchNo ?? 'No lot'}</td>
                    <td className="py-2.5 pr-3 text-xs">
                      {row.expiryDate ? (
                        <span className={row.expired ? 'font-semibold text-rose-800' : ''}>{row.expiryDate}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {row.onHand} {row.unit}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-amber-900">{row.reserved}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-teal-900">
                      {row.available} {row.unit}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-xs text-slate-600">
                      {row.minLevel ?? '—'}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={row.stockStatus} />
                    </td>
                    <td className="py-2.5 text-xs">{row.active ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!paged.length ? (
              <p className="py-10 text-center text-sm text-slate-500">No matching catalogue or batch rows.</p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span>
              Showing {paged.length} of {filtered.length} lot/product rows · Page {safePage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

function StatusBadge({ status }: { status: StockRow['stockStatus'] }) {
  const map: Record<StockRow['stockStatus'], { label: string; cls: string }> = {
    IN_STOCK: { label: 'IN STOCK', cls: 'bg-emerald-100 text-emerald-900' },
    LOW_STOCK: { label: 'LOW STOCK', cls: 'bg-amber-100 text-amber-900' },
    OUT_OF_STOCK: { label: 'OUT OF STOCK', cls: 'bg-rose-100 text-rose-900' },
    EXPIRED: { label: 'EXPIRED LOT', cls: 'bg-rose-200 text-rose-950' },
    INACTIVE: { label: 'INACTIVE', cls: 'bg-slate-200 text-slate-700' },
  }
  const item = map[status]
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${item.cls}`}>{item.label}</span>
}
