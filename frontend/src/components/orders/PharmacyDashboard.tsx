import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Package, Pill, ShoppingBag, Timer } from 'lucide-react'
import { apiRequest } from '../../lib/api'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { LabQueueItem, LabSection, LabStatCard, waitLabel } from '../investigations/lab-ui'

type PharmacyOrder = {
  id: string
  orderNo: string
  status: string
  priority: string
  orderedAt: string
  patient?: { firstName: string; lastName: string; patientNo: string }
  metadata?: {
    medication?: string
    dose?: string
    frequency?: string
    quantity?: number | string | null
  } | null
}

type Location = { id: string; name: string; code: string; locationType: string }

type BalanceBatch = {
  id: string
  batchNo: string
  qtyOnHand: string
  expiryDate: string | null
  item: { id: string; sku: string; name: string; unit: string }
}

const LOW_STOCK = 10
const EXPIRY_DAYS = 90

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export function PharmacyDashboard({
  onOpenDispense,
  onOpenStockTake,
  onOpenReceive,
  onOpenProducts,
}: {
  onOpenDispense?: () => void
  onOpenStockTake?: () => void
  onOpenReceive?: () => void
  onOpenProducts?: () => void
}) {
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['clinical-orders', 'pharmacy'],
    queryFn: () => apiRequest<PharmacyOrder[]>('/clinical-orders?module=pharmacy&limit=100'),
    refetchInterval: 20_000,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })

  const pharmacy = locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy')

  const { data: balances, isLoading: stockLoading } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id],
    queryFn: () =>
      apiRequest<{ batches: BalanceBatch[]; totalSkus: number }>(
        `/inventory/locations/${pharmacy!.id}/balances`,
      ),
    enabled: Boolean(pharmacy?.id),
    refetchInterval: 30_000,
  })

  const pending = orders.filter((order) => order.status !== 'dispensed' && order.status !== 'cancelled')
  const partial = pending.filter((order) => order.status === 'partially_dispensed')
  const urgent = pending.filter((order) => order.priority === 'stat' || order.priority === 'urgent')
  const todayStart = startOfToday().getTime()
  const dispensedToday = orders.filter(
    (order) => order.status === 'dispensed' && new Date(order.orderedAt).getTime() >= todayStart,
  )
  const aged = pending.filter((order) => Date.now() - new Date(order.orderedAt).getTime() > 2 * 60 * 60 * 1000)

  const { lowStock, expiring } = useMemo(() => {
    const qtyByItem = new Map<string, { name: string; unit: string; qty: number }>()
    const soon: Array<{ name: string; batchNo: string; expiryDate: string; qty: number }> = []
    const horizon = Date.now() + EXPIRY_DAYS * 86_400_000

    for (const batch of balances?.batches ?? []) {
      const qty = Number(batch.qtyOnHand)
      if (!Number.isFinite(qty) || qty <= 0) continue
      const current = qtyByItem.get(batch.item.id) ?? {
        name: batch.item.name,
        unit: batch.item.unit,
        qty: 0,
      }
      current.qty += qty
      qtyByItem.set(batch.item.id, current)
      if (batch.expiryDate) {
        const expiry = new Date(batch.expiryDate).getTime()
        if (expiry <= horizon) {
          soon.push({
            name: batch.item.name,
            batchNo: batch.batchNo,
            expiryDate: batch.expiryDate,
            qty,
          })
        }
      }
    }

    return {
      lowStock: [...qtyByItem.values()].filter((row) => row.qty <= LOW_STOCK).sort((a, b) => a.qty - b.qty),
      expiring: soon.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    }
  }, [balances])

  const loading = ordersLoading || (Boolean(pharmacy?.id) && stockLoading)

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-skeleton rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white" onClick={onOpenDispense}>
          Open pharmacy queue
        </button>
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium" onClick={onOpenStockTake}>
          New stock take
        </button>
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium" onClick={onOpenReceive}>
          Receive stock
        </button>
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium" onClick={onOpenProducts}>
          Products
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LabStatCard
          label="Awaiting dispense"
          value={pending.length}
          icon={Pill}
          tone="border-teal-200/80 bg-gradient-to-br from-teal-50 to-white text-teal-950"
          hint={urgent.length ? `${urgent.length} STAT/urgent` : 'Prescriptions still on the bench'}
        />
        <LabStatCard
          label="Partial prescriptions"
          value={partial.length}
          icon={Clock}
          tone="border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950"
          hint="Some lines already issued"
        />
        <LabStatCard
          label="Dispensed today"
          value={dispensedToday.length}
          icon={ShoppingBag}
          tone="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-950"
          hint="Closed in the loaded queue"
        />
        <LabStatCard
          label="Low / expiring"
          value={lowStock.length + expiring.length}
          icon={Timer}
          tone="border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-950"
          hint={`≤${LOW_STOCK} units or expiry within ${EXPIRY_DAYS} days`}
        />
      </div>

      <LabSection
        title="Dispense queue"
        description="Oldest pending prescriptions first. Open a card to dispense from pharmacy stock."
      >
        {pending.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pending.slice(0, 12).map((order) => (
              <LabQueueItem
                key={order.id}
                onClick={() => onOpenDispense?.()}
                name={
                  order.patient
                    ? `${order.patient.firstName} ${order.patient.lastName}`
                    : 'Unknown patient'
                }
                patientNo={
                  order.patient?.patientNo
                    ? formatPatientNoShort(order.patient.patientNo)
                    : order.orderNo
                }
                status={order.status}
                priority={order.priority}
                wait={waitLabel(order.orderedAt)}
                subtitle={
                  order.metadata?.medication
                    ? [
                        order.metadata.medication,
                        order.metadata.dose,
                        order.metadata.frequency,
                        order.metadata.quantity != null ? `qty ${String(order.metadata.quantity)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : order.orderNo
                }
              />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">No pending prescriptions — queue is clear.</p>
        )}
        {aged.length ? (
          <p className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-800">
            <Clock className="h-3.5 w-3.5" />
            {aged.length} script{aged.length === 1 ? '' : 's'} waiting over 2 hours.
          </p>
        ) : null}
      </LabSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <LabSection
          title="Low pharmacy stock"
          description={`${pharmacy?.name ?? 'PHARMACY'} location only — request more from Store, do not receive supplier deliveries here.`}
        >
          {lowStock.length ? (
            <ul className="divide-y divide-slate-100">
              {lowStock.slice(0, 8).map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-medium text-slate-800">{row.name}</span>
                  <span className="tabular-nums text-rose-800">
                    {row.qty} {row.unit}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              {pharmacy ? 'No items at or below the low-stock mark.' : 'Pharmacy location is not configured.'}
            </p>
          )}
        </LabSection>

        <LabSection title="Expiring batches" description={`Within ${EXPIRY_DAYS} days at the pharmacy bench.`}>
          {expiring.length ? (
            <ul className="divide-y divide-slate-100">
              {expiring.slice(0, 8).map((row) => (
                <li key={`${row.batchNo}-${row.expiryDate}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      Batch {row.batchNo} · {row.qty} left
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-amber-800">
                    {new Date(row.expiryDate).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Package className="h-4 w-4" />
              No batches nearing expiry in the current stock.
            </p>
          )}
        </LabSection>
      </div>
    </div>
  )
}
