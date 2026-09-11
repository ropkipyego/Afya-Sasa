import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRightLeft, Boxes, Clock, Package, Truck } from 'lucide-react'
import { Button } from '../ui'
import { apiRequest } from '../../lib/api'
import { LabSection, LabStatCard, waitLabel } from '../investigations/lab-ui'

type Location = { id: string; name: string; code: string; locationType: string }
type Item = { id: string; sku: string; name: string; unit: string; category: string }
type Batch = {
  id: string
  batchNo: string | null
  expiryDate: string | null
  qtyOnHand: string
  item: Item
}
type Requisition = {
  id: string
  requisitionNo: string
  requestingDepartment: string
  status: string
  createdAt: string
}
type Transfer = {
  id: string
  status: string
  createdAt: string
  sourceLocation: Location
  destinationLocation: Location
}

const LOW_STOCK = 10
const EXPIRY_DAYS = 90

export function InventoryOverview({
  onOpen,
}: {
  onOpen: (tab: 'stock' | 'requisitions' | 'transfers' | 'procurement' | 'receive') => void
}) {
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })

  const store = locations.find((l) => l.code === 'MAIN_STORE' || l.locationType === 'main_store')
  const pharmacy = locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy')

  const { data: storeBalances, isLoading: storeLoading } = useQuery({
    queryKey: ['inventory-balances', store?.id],
    queryFn: () => apiRequest<{ batches: Batch[] }>(`/inventory/locations/${store!.id}/balances`),
    enabled: Boolean(store?.id),
    refetchInterval: 30_000,
  })

  const { data: requisitions = [], isLoading: reqLoading } = useQuery({
    queryKey: ['inventory-requisitions'],
    queryFn: () => apiRequest<Requisition[]>('/inventory/requisitions'),
    refetchInterval: 20_000,
  })

  const { data: transfers = [] } = useQuery({
    queryKey: ['inventory-transfers'],
    queryFn: () => apiRequest<Transfer[]>('/inventory/transfers'),
    refetchInterval: 20_000,
  })

  const { data: configuredLowStock = [] } = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: () =>
      apiRequest<Array<{ id: string; name: string; unit: string; qtyOnHand: number; minLevel?: string | null }>>(
        '/inventory/alerts/low-stock',
      ),
    retry: false,
  })

  const openReqs = requisitions.filter((r) => !['completed', 'cancelled'].includes(r.status))
  const moving = transfers.filter((t) => t.status === 'pending' || t.status === 'in_transit')

  const { lowStock, expiring } = useMemo(() => {
    const qtyByItem = new Map<string, { name: string; unit: string; qty: number }>()
    const soon: Array<{ name: string; batchNo: string; expiryDate: string }> = []
    const horizon = Date.now() + EXPIRY_DAYS * 86_400_000
    for (const batch of storeBalances?.batches ?? []) {
      const qty = Number(batch.qtyOnHand)
      if (!Number.isFinite(qty) || qty <= 0) continue
      const current = qtyByItem.get(batch.item.id) ?? { name: batch.item.name, unit: batch.item.unit, qty: 0 }
      current.qty += qty
      qtyByItem.set(batch.item.id, current)
      if (batch.expiryDate && new Date(batch.expiryDate).getTime() <= horizon) {
        soon.push({
          name: batch.item.name,
          batchNo: batch.batchNo ?? '—',
          expiryDate: batch.expiryDate,
        })
      }
    }
    const fallback = [...qtyByItem.values()].filter((row) => row.qty <= LOW_STOCK).sort((a, b) => a.qty - b.qty)
    return {
      lowStock:
        configuredLowStock.length > 0
          ? configuredLowStock.map((row) => ({ name: row.name, unit: row.unit, qty: row.qtyOnHand }))
          : fallback,
      expiring: soon.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    }
  }, [configuredLowStock, storeBalances])

  if (storeLoading || reqLoading) {
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LabStatCard
          label="Open requisitions"
          value={openReqs.length}
          icon={Truck}
          tone="border-sky-200 bg-gradient-to-br from-sky-50 to-white text-sky-950"
          hint="Ward and department asks"
        />
        <LabStatCard
          label="Transfers moving"
          value={moving.length}
          icon={ArrowRightLeft}
          tone="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white text-indigo-950"
          hint="Pending or in transit"
        />
        <LabStatCard
          label="Low at main store"
          value={lowStock.length}
          icon={AlertTriangle}
          tone="border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950"
          hint={
            configuredLowStock.length
              ? 'Below configured minimum level'
              : `≤${LOW_STOCK} units at ${store?.name ?? 'main store'}`
          }
        />
        <LabStatCard
          label="Expiring at store"
          value={expiring.length}
          icon={Clock}
          tone="border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-950"
          hint={`Within ${EXPIRY_DAYS} days`}
        />
      </div>

      <LabSection
        title="Supply queue"
        description={`${store?.name ?? 'Main store'} is the warehouse. ${pharmacy?.name ?? 'Pharmacy'} is a location, not this desk.`}
      >
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => onOpen('requisitions')}>
            Work requisitions
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpen('procurement')}>
            Buying list
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpen('receive')}>
            Receive stock
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpen('stock')}>
            <Boxes className="h-4 w-4" />
            Stock levels
          </Button>
        </div>
      </LabSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <LabSection title="Open requisitions" description="Oldest first">
          {openReqs.length ? (
            <ul className="divide-y divide-slate-100">
              {openReqs.slice(0, 8).map((req) => (
                <li key={req.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{req.requisitionNo}</p>
                    <p className="text-xs text-slate-500">
                      {req.requestingDepartment} · {req.status} · {waitLabel(req.createdAt)}
                    </p>
                  </div>
                  <Button type="button" variant="secondary" className="px-3 py-2 text-xs" onClick={() => onOpen('requisitions')}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No open requisitions.</p>
          )}
        </LabSection>

        <LabSection title="Low / expiring at main store" description="Use the buying list if store cannot issue.">
          {lowStock.length || expiring.length ? (
            <ul className="divide-y divide-slate-100">
              {lowStock.slice(0, 6).map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-medium text-slate-800">{row.name}</span>
                  <span className="tabular-nums text-amber-800">
                    {row.qty} {row.unit}
                  </span>
                </li>
              ))}
              {expiring.slice(0, 4).map((row) => (
                <li key={`${row.name}-${row.batchNo}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-500">Batch {row.batchNo}</p>
                  </div>
                  <span className="text-xs font-semibold text-rose-800">
                    {new Date(row.expiryDate).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Package className="h-4 w-4" />
              {store ? 'Main store looks healthy on loaded stock.' : 'Main store location is not configured.'}
            </p>
          )}
        </LabSection>
      </div>
    </div>
  )
}
