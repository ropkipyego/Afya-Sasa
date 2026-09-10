import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { LabSection } from '../investigations/lab-ui'

type Location = { id: string; name: string; code: string; locationType: string }
type Item = {
  id: string
  sku: string
  name: string
  unit: string
  category: 'pharmaceutical' | 'medical_consumable' | 'non_medical'
}
type Batch = { qtyOnHand: string; item: Item }
type RequisitionLine = {
  id: string
  quantityRequested: string
  quantityIssued: string
  fulfillmentRoute: 'pharmacy' | 'main_store'
  item: Item
}
type Requisition = {
  id: string
  requisitionNo: string
  requestingDepartment: string
  status: string
  lines: RequisitionLine[]
}

type BuyRow = {
  itemId: string
  name: string
  sku: string
  unit: string
  category: string
  storeQty: number
  outstanding: number
  reason: string
}

const LOW_STOCK = 10

export function ProcurementPanel({
  onReceiveItem,
  onOpenRequisitions,
}: {
  onReceiveItem: (itemId: string) => void
  onOpenRequisitions: () => void
}) {
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => apiRequest<Item[]>('/inventory/items'),
  })

  const store = locations.find((l) => l.code === 'MAIN_STORE' || l.locationType === 'main_store')
  const pharmacy = locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy')

  const { data: storeBalances } = useQuery({
    queryKey: ['inventory-balances', store?.id],
    queryFn: () => apiRequest<{ batches: Batch[] }>(`/inventory/locations/${store!.id}/balances`),
    enabled: Boolean(store?.id),
  })
  const { data: pharmacyBalances } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id],
    queryFn: () => apiRequest<{ batches: Batch[] }>(`/inventory/locations/${pharmacy!.id}/balances`),
    enabled: Boolean(pharmacy?.id),
  })
  const { data: requisitions = [], isLoading } = useQuery({
    queryKey: ['inventory-requisitions'],
    queryFn: () => apiRequest<Requisition[]>('/inventory/requisitions'),
    refetchInterval: 20_000,
  })

  const rows = useMemo(() => {
    const qtyAt = (batches: Batch[] | undefined, itemId: string) =>
      (batches ?? []).reduce((sum, batch) => {
        if (batch.item.id !== itemId) return sum
        const qty = Number(batch.qtyOnHand)
        return sum + (Number.isFinite(qty) ? qty : 0)
      }, 0)

    const outstandingByItem = new Map<string, number>()
    for (const req of requisitions) {
      if (['completed', 'cancelled'].includes(req.status)) continue
      for (const line of req.lines ?? []) {
        const need = Number(line.quantityRequested) - Number(line.quantityIssued || 0)
        if (need <= 0) continue
        outstandingByItem.set(line.item.id, (outstandingByItem.get(line.item.id) ?? 0) + need)
      }
    }

    const list: BuyRow[] = []
    for (const item of items) {
      const storeQty =
        item.category === 'pharmaceutical' ? qtyAt(pharmacyBalances?.batches, item.id) : qtyAt(storeBalances?.batches, item.id)
      const outstanding = outstandingByItem.get(item.id) ?? 0
      const low = storeQty <= LOW_STOCK
      if (!low && outstanding <= 0) continue
      list.push({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        category: item.category,
        storeQty,
        outstanding,
        reason: outstanding > 0 && low ? 'Ward ask + low stock' : outstanding > 0 ? 'Unfilled requisition' : 'Low stock',
      })
    }
    return list.sort((a, b) => b.outstanding - a.outstanding || a.storeQty - b.storeQty)
  }, [items, requisitions, storeBalances, pharmacyBalances])

  return (
    <div className="space-y-6">
      <Card className="p-5 md:p-8">
        <PageHeader
          title="Buying list"
          description="What store or pharmacy cannot cover from current stock. Receive against a supplier GRN here. Purchase orders and supplier invoices need approved tables — they are not invented on this screen."
        />
        <Alert tone="info" className="mt-4">
          Pharmaceuticals receive into the pharmacy location. Consumables receive into main store. After stock is on
          the shelf, issue the open requisition.
        </Alert>
      </Card>

      <LabSection title="Items to buy or restock" description={`${rows.length} items need attention`}>
        {isLoading ? (
          <div className="h-40 animate-skeleton rounded-2xl" />
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4">Item</th>
                  <th className="pb-3 pr-4">On hand</th>
                  <th className="pb-3 pr-4">Still asked</th>
                  <th className="pb-3 pr-4">Why</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.itemId} className="border-b border-slate-100">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.sku} · {row.category.replace('_', ' ')}
                      </p>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {row.storeQty} {row.unit}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {row.outstanding ? `${row.outstanding} ${row.unit}` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{row.reason}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          className="px-3 py-2 text-xs"
                          onClick={() => onReceiveItem(row.itemId)}
                        >
                          Receive
                        </Button>
                        {row.outstanding ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-2 text-xs"
                            onClick={onOpenRequisitions}
                          >
                            Requisitions
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">
            No buying pressure on the loaded stock and requisitions.
          </p>
        )}
      </LabSection>
    </div>
  )
}
