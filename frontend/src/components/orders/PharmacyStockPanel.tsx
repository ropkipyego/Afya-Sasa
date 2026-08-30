import { useQuery } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { Alert, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type Location = { id: string; name: string; code: string; locationType: string }

type BalanceBatch = {
  id: string
  batchNo: string
  qtyOnHand: string
  expiryDate: string | null
  item: { id: string; sku: string; name: string; unit: string; category: string }
}

export function PharmacyStockPanel() {
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })

  const pharmacy = locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy')

  const { data: balances, isLoading, error } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id],
    queryFn: () =>
      apiRequest<{ batches: BalanceBatch[]; totalSkus: number }>(
        `/inventory/locations/${pharmacy!.id}/balances`,
      ),
    enabled: Boolean(pharmacy?.id),
  })

  const batches = (balances?.batches ?? []).filter((b) => Number(b.qtyOnHand) > 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-emerald-800 to-teal-900 p-8 text-white">
        <PageHeader
          title="Pharmacy stock"
          description="Live batch balances at the pharmacy store — every dispense and OTC sale deducts from here."
        />
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="rounded-xl bg-white/15 px-4 py-2">
            SKUs in stock: <strong>{balances?.totalSkus ?? batches.length}</strong>
          </span>
          <span className="rounded-xl bg-white/15 px-4 py-2">
            Location: <strong>{pharmacy?.name ?? 'Not configured'}</strong>
          </span>
        </div>
      </Card>

      {!pharmacy ? (
        <Alert tone="warning">
          Pharmacy location is not configured. Add a location with code PHARMACY in Inventory & Store setup.
        </Alert>
      ) : null}

      {error ? <Alert tone="error">{(error as Error).message}</Alert> : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Package className="h-5 w-5 text-teal-700" />
            Batch balances
          </h3>
        </div>
        {isLoading ? (
          <div className="h-48 animate-skeleton" />
        ) : batches.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No stock on hand at pharmacy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3">SKU</th>
                  <th className="px-6 py-3">Batch</th>
                  <th className="px-6 py-3">Qty</th>
                  <th className="px-6 py-3">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-medium text-slate-900">{batch.item.name}</td>
                    <td className="px-6 py-3 text-slate-600">{batch.item.sku}</td>
                    <td className="px-6 py-3 text-slate-600">{batch.batchNo}</td>
                    <td className="px-6 py-3 font-semibold tabular-nums">
                      {batch.qtyOnHand} {batch.item.unit}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
