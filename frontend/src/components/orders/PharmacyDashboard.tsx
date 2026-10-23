import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, Package, Pill, ShoppingBag } from 'lucide-react'
import { Alert } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { formatKes } from '../../lib/clinical-catalog'
import { LabSection, LabStatCard } from '../investigations/lab-ui'

type DashboardSummary = {
  pharmacyLocation: { id: string; name: string; code: string } | null
  prescriptions: {
    pendingTotal: number
    opdPending: number
    ipdPending: number
    partialCount: number
    urgentCount: number
  }
  otcToday: {
    preparedSalesCount: number
    chargedAmountKes: number
    completedPaymentsCount: number
    collectedAmountKes: number
    outstandingKes: number
  }
  stock: {
    onHand: number
    reserved: number
    available: number
    lowStockCount: number
    outOfStockCount: number
    nearExpiryCount: number
    expiredCount: number
    quarantinedCount: number | null
    quarantinePolicyNote: string
  }
  stockTake: {
    pendingSessions: number
    awaitingApproval: number
  }
  lowStockItems: Array<{
    itemId: string
    sku: string
    name: string
    unit: string
    onHand: number
    available: number
    minLevel: number
  }>
  outOfStockItems: Array<{
    itemId: string
    sku: string
    name: string
    unit: string
    minLevel: number | null
  }>
  nearExpiryBatches: Array<{
    batchId: string
    sku: string
    name: string
    batchNo: string | null
    expiryDate: string
    qtyOnHand: number
    availableQty: number
  }>
  expiredBatches: Array<{
    batchId: string
    sku: string
    name: string
    batchNo: string | null
    expiryDate: string
    qtyOnHand: number
  }>
  openOtcQueue: Array<{
    chargeId: string
    saleId: string
    orderNo: string
    customerName: string
    description: string
    amountOwed: number
    amountPaid: number
    status: string
    createdAt: string
  }>
  recentMovements: Array<{
    id: string
    transactionType: string
    quantity: number
    unit: string
    itemName: string
    sku: string
    batchNo: string | null
    reason: string | null
    createdAt: string
  }>
}

export function PharmacyDashboard({
  onOpenQueue,
  onOpenPos,
  onOpenStock,
  onOpenConfig,
}: {
  onOpenQueue?: (mode?: 'opd' | 'ipd' | 'otc') => void
  onOpenDispense?: () => void
  onOpenPos?: () => void
  onOpenStock?: () => void
  onOpenConfig?: () => void
  onOpenStockTake?: () => void
  onOpenReceive?: () => void
  onOpenProducts?: () => void
  onOpenSales?: () => void
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pharmacy-dashboard'],
    queryFn: () => apiRequest<DashboardSummary>('/inventory/pharmacy-dashboard'),
    refetchInterval: 20_000,
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-skeleton rounded-2xl" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <Alert tone="error">
        {formatApiError(error, 'Could not load pharmacy operational summary.')}
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
          onClick={() => (onOpenQueue ? onOpenQueue('opd') : undefined)}
        >
          Prescription & OTC Queue
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
          onClick={onOpenPos}
        >
          OTC Point of Sale
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
          onClick={onOpenStock}
        >
          Products & Stock
        </button>
        {onOpenConfig ? (
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            onClick={onOpenConfig}
          >
            Pharmacy Configuration
          </button>
        ) : null}
      </div>

      {!data.pharmacyLocation ? (
        <Alert tone="warning">Pharmacy location (PHARMACY) is not configured.</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LabStatCard
          label="Pending prescriptions"
          value={data.prescriptions.pendingTotal}
          icon={Pill}
          tone="border-teal-200/80 bg-gradient-to-br from-teal-50 to-white text-teal-950"
          hint={`OPD ${data.prescriptions.opdPending} · IPD ${data.prescriptions.ipdPending}${
            data.prescriptions.urgentCount ? ` · ${data.prescriptions.urgentCount} STAT/urgent` : ''
          }`}
        />
        <LabStatCard
          label="OTC sales today"
          value={data.otcToday.preparedSalesCount}
          icon={ShoppingBag}
          tone="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-950"
          hint={`Collected ${formatKes(data.otcToday.collectedAmountKes)} · Charged ${formatKes(
            data.otcToday.chargedAmountKes,
          )} · Owed ${formatKes(data.otcToday.outstandingKes)}`}
        />
        <LabStatCard
          label="Available stock (units)"
          value={data.stock.available}
          icon={Package}
          tone="border-sky-200 bg-gradient-to-br from-sky-50 to-white text-sky-950"
          hint={`On-hand ${data.stock.onHand} · Reserved/held ${data.stock.reserved}`}
        />
        <LabStatCard
          label="Stock & count exceptions"
          value={
            data.stock.lowStockCount +
            data.stock.outOfStockCount +
            data.stock.expiredCount +
            data.stockTake.pendingSessions
          }
          icon={Clock}
          tone="border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950"
          hint={`Low ${data.stock.lowStockCount} · Out ${data.stock.outOfStockCount} · Expired ${data.stock.expiredCount} · Stock-take open ${data.stockTake.pendingSessions} (${data.stockTake.awaitingApproval} awaiting approval)`}
        />
      </div>

      <Alert tone="info">
        Collected amounts reflect posted payments in <code>demo.payment_transactions</code>, not profit.{' '}
        {data.stock.quarantinePolicyNote}
      </Alert>

      <div className="grid gap-6 xl:grid-cols-2">
        <LabSection
          title="Low & out-of-stock items"
          description="Evaluated against configured reorder level (min_level) on active pharmaceutical items."
        >
          {data.outOfStockItems.length || data.lowStockItems.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.outOfStockItems.slice(0, 6).map((item) => (
                <li key={item.itemId} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <span className="font-medium text-slate-900">{item.name}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">{item.sku}</span>
                  </div>
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-900">
                    OUT OF STOCK (min {item.minLevel ?? 10})
                  </span>
                </li>
              ))}
              {data.lowStockItems.slice(0, 8).map((item) => (
                <li key={item.itemId} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <span className="font-medium text-slate-900">{item.name}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">{item.sku}</span>
                  </div>
                  <span className="tabular-nums text-amber-900">
                    {item.available} {item.unit} available (on-hand {item.onHand}, min {item.minLevel})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">All active items are above reorder thresholds.</p>
          )}
        </LabSection>

        <LabSection
          title="Near-expiry & expired batches"
          description="Expired batches are excluded from available quantity and blocked from dispensing."
        >
          {data.expiredBatches.length || data.nearExpiryBatches.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.expiredBatches.map((batch) => (
                <li key={batch.batchId} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium text-rose-900">{batch.name}</p>
                    <p className="text-xs text-slate-500">
                      Batch {batch.batchNo ?? '—'} · On-hand {batch.qtyOnHand}
                    </p>
                  </div>
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-900">
                    EXPIRED {batch.expiryDate}
                  </span>
                </li>
              ))}
              {data.nearExpiryBatches.map((batch) => (
                <li key={batch.batchId} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium text-slate-900">{batch.name}</p>
                    <p className="text-xs text-slate-500">
                      Batch {batch.batchNo ?? '—'} · Available {batch.availableQty}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-amber-800">Expires {batch.expiryDate}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">No expired or near-expiry batches within 90 days.</p>
          )}
        </LabSection>
      </div>

      <LabSection
        title="Recent dispensing & stock movement activity"
        description="Authoritative entries from demo.inventory_transactions."
      >
        {data.recentMovements.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3">When</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Product</th>
                  <th className="pb-2 pr-3">Batch</th>
                  <th className="pb-2 pr-3 text-right">Qty</th>
                  <th className="pb-2">Reference / Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.recentMovements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-xs text-slate-500">{new Date(m.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3 font-mono text-xs font-semibold">{m.transactionType}</td>
                    <td className="py-2 pr-3">
                      {m.itemName} <span className="font-mono text-xs text-slate-500">({m.sku})</span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{m.batchNo ?? '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {m.quantity} {m.unit}
                    </td>
                    <td className="py-2 text-xs text-slate-600">{m.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
            <AlertTriangle className="h-4 w-4" />
            No stock movements recorded yet.
          </p>
        )}
      </LabSection>
    </div>
  )
}
