import { useQuery } from '@tanstack/react-query'
import { Alert, Card, PageHeader } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { useAuthStore } from '../../lib/auth-store'

type Location = { id: string; name: string; code: string; locationType: string }
type Transfer = { id: string; transferNo: string; status: string; sourceLocation?: { name: string }; destinationLocation?: { name: string } }
type Requisition = { id: string; requisitionNo?: string; status: string; requestingDepartment?: string }
type Transaction = {
  id: string
  transactionType: string
  quantity: string
  createdAt: string
  item?: { name: string; sku: string }
  sourceLocation?: { name: string } | null
}
type Integrity = {
  negativeStock?: Array<{ sku: string; name: string; qty: number; location: string }>
  balanceMismatch?: Array<{ sku: string; name: string; stored: number; ledger: number; difference: number }>
}
type StockTake = { sessionId?: string; postedAt?: string; lines?: number }
type LowStock = { name: string; sku: string; qtyOnHand?: number; minLevel?: string | null }
type Oversight = {
  locations: number
  onHand: number
  reserved: number
  available: number
  expiredLots: number
  nearExpiryLots: number
  pendingStockTakes: number
}

export function StockOverviewPanel() {
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations', 'oversight'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const { data: low = [], error: lowError } = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: () => apiRequest<LowStock[]>('/inventory/alerts/low-stock'),
  })
  const { data: summary, error: summaryError } = useQuery({
    queryKey: ['inventory-oversight-summary'],
    queryFn: () => apiRequest<Oversight>('/inventory/oversight-summary'),
  })
  return (
    <div className="space-y-4">
      <PageHeader title="Stock overview" description="On-hand is physical quantity. Reserved is prepared/held. Available is on-hand minus held. Receiving stays on Inventory & Store." />
      {lowError ? <Alert tone="error">{formatApiError(lowError, 'Could not load low-stock alerts.')}</Alert> : null}
      {summaryError ? <Alert tone="error">{formatApiError(summaryError, 'Could not load stock totals.')}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label="On hand" value={String(summary?.onHand ?? '—')} />
        <Tile label="Reserved / held" value={String(summary?.reserved ?? '—')} />
        <Tile label="Available" value={String(summary?.available ?? '—')} />
        <Tile label="Pending stock takes" value={String(summary?.pendingStockTakes ?? '—')} />
        <Tile label="Low-stock alerts" value={String(low.length)} />
        <Tile label="Near expiry (90 days)" value={String(summary?.nearExpiryLots ?? '—')} />
        <Tile label="Expired lots on hand" value={String(summary?.expiredLots ?? '—')} />
        <Tile label="Pharmacy location" value={locations.find((row) => row.code === 'PHARMACY')?.name ?? 'Not configured'} />
      </div>
      <Card className="p-4">
        <h3 className="font-semibold">Low stock</h3>
        {low.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {low.slice(0, 30).map((row, index) => (
              <li key={index}>
                {row.name} ({row.sku}) · on hand {row.qtyOnHand ?? '—'} · min {row.minLevel ?? '—'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No low-stock rows.</p>
        )}
      </Card>
    </div>
  )
}

export function StockStoresPanel() {
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations', 'stores'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const { data: transfers = [], error: transferError } = useQuery({
    queryKey: ['inventory-transfers', 'oversight'],
    queryFn: () => apiRequest<Transfer[]>('/inventory/transfers'),
  })
  const { data: requisitions = [], error: reqError } = useQuery({
    queryKey: ['inventory-requisitions', 'oversight'],
    queryFn: () => apiRequest<Requisition[]>('/inventory/requisitions'),
  })
  return (
    <div className="space-y-4">
      <PageHeader
        title="Stores & transfers"
        description="Oversight only. Create, ship and receive transfers on Inventory & Store. Goods receipt is excluded from this Control Center."
      />
      {transferError ? <Alert tone="error">{formatApiError(transferError, 'Could not load transfers.')}</Alert> : null}
      {reqError ? <Alert tone="error">{formatApiError(reqError, 'Could not load requisitions.')}</Alert> : null}
      <Card className="p-4">
        <h3 className="font-semibold">Locations</h3>
        <ul className="mt-2 text-sm">
          {locations.map((row) => (
            <li key={row.id}>
              {row.name} · {row.code} · {row.locationType}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold">Open transfers</h3>
        <ul className="mt-2 text-sm">
          {transfers.filter((row) => row.status !== 'completed' && row.status !== 'cancelled').map((row) => (
            <li key={row.id}>
              {row.transferNo} · {row.status} · {row.sourceLocation?.name} → {row.destinationLocation?.name}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold">Requisitions</h3>
        <ul className="mt-2 text-sm">
          {requisitions.slice(0, 40).map((row) => (
            <li key={row.id}>
              {row.requisitionNo ?? row.id.slice(0, 8)} · {row.status} · {row.requestingDepartment}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

export function StockControlPanel() {
  const canManage = useAuthStore((s) => (s.user?.permissions ?? []).includes('inventory:manage'))
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations', 'control'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const pharmacy = locations.find((row) => row.code === 'PHARMACY')
  const { data: balances } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id, 'control'],
    queryFn: () =>
      apiRequest<{
        batches: Array<{
          id: string
          batchNo: string
          qtyOnHand: string
          availableQuantity?: number
          expiryDate?: string | null
          item: { name: string; sku: string }
        }>
      }>(`/inventory/locations/${pharmacy!.id}/balances`),
    enabled: Boolean(pharmacy?.id),
  })
  const { data: stockTakes = [] } = useQuery({
    queryKey: ['inventory-stock-takes'],
    queryFn: () => apiRequest<StockTake[]>('/inventory/stock-takes'),
  })
  const today = new Date().toISOString().slice(0, 10)
  const expiring = (balances?.batches ?? []).filter((batch) => batch.expiryDate && batch.expiryDate <= addDays(today, 90))
  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock control"
        description="Balances and expiry from the live pharmacy location. Count and independent approval live on Inventory & Store / Pharmacy stock take. Recall, quarantine, disposal and returns remain blocked until policy exists."
      />
      {!canManage ? (
        <Alert tone="info">Viewing stock does not permit adjustments. Posting a stock take needs inventory:manage on Inventory & Store.</Alert>
      ) : (
        <Alert tone="info">
          A separate variance-approval role is not configured. Do not treat preview as posted. Confirm stock takes on Inventory & Store.
        </Alert>
      )}
      <Card className="p-4">
        <h3 className="font-semibold">Pharmacy batches (available after holds)</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-500">
              <th className="pb-2">Item</th>
              <th className="pb-2">Batch</th>
              <th className="pb-2">On hand</th>
              <th className="pb-2">Available</th>
              <th className="pb-2">Expiry</th>
            </tr>
          </thead>
          <tbody>
            {(balances?.batches ?? []).slice(0, 40).map((batch) => (
              <tr key={batch.id} className="border-t border-slate-100">
                <td className="py-1">{batch.item.name}</td>
                <td className="py-1 font-mono text-xs">{batch.batchNo}</td>
                <td className="py-1">{batch.qtyOnHand}</td>
                <td className="py-1">{batch.availableQuantity ?? batch.qtyOnHand}</td>
                <td className="py-1">{batch.expiryDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold">Expiry within 90 days</h3>
        <ul className="mt-2 text-sm">
          {expiring.slice(0, 20).map((batch) => (
            <li key={batch.id}>
              {batch.item.name} · {batch.batchNo} · {batch.expiryDate}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold">Stock-take history</h3>
        <ul className="mt-2 text-sm">
          {stockTakes.slice(0, 20).map((row, index) => (
            <li key={row.sessionId ?? index}>
              {row.postedAt ? new Date(row.postedAt).toLocaleString() : 'Session'} · {row.sessionId} · {row.lines ?? 0} lines
            </li>
          ))}
        </ul>
      </Card>
      <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Blocked without policy: recall, quarantine, disposal, customer returns to stock, and a named variance approver.
      </Card>
    </div>
  )
}

export function StockReportsPanel() {
  const { data: movements = [], error } = useQuery({
    queryKey: ['inventory-transactions', 'oversight'],
    queryFn: () => apiRequest<Transaction[]>('/inventory/transactions?limit=80'),
  })
  const { data: integrity, error: integrityError } = useQuery({
    queryKey: ['inventory-integrity'],
    queryFn: () => apiRequest<Integrity>('/inventory/integrity'),
  })
  return (
    <div className="space-y-4">
      <PageHeader title="Stock reports & audit" description="Ledger and integrity from inventory_transactions. This is not a second general ledger." />
      {error ? <Alert tone="error">{formatApiError(error, 'Could not load movements.')}</Alert> : null}
      {integrityError ? <Alert tone="error">{formatApiError(integrityError, 'Integrity report unavailable.')}</Alert> : null}
      <Card className="p-4">
        <h3 className="font-semibold">Integrity</h3>
        <p className="mt-2 text-sm">Negative stock rows: {integrity?.negativeStock?.length ?? 0}</p>
        <p className="text-sm">Balance mismatches: {integrity?.balanceMismatch?.length ?? 0}</p>
        {(integrity?.balanceMismatch ?? []).slice(0, 8).map((row) => (
          <p key={row.sku} className="text-sm">
            {row.name} ({row.sku}): stored {row.stored} vs ledger {row.ledger} (diff {row.difference})
          </p>
        ))}
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold">Recent movements</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-500">
              <th className="pb-2">When</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Item</th>
              <th className="pb-2">Qty</th>
            </tr>
          </thead>
          <tbody>
            {movements.slice(0, 40).map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="py-1 text-xs">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="py-1">{row.transactionType}</td>
                <td className="py-1">{row.item?.name}</td>
                <td className="py-1">{row.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
