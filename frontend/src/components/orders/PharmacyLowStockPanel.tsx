import { useQuery } from '@tanstack/react-query'
import { Alert, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type LowStockRow = {
  id: string
  name: string
  unit: string
  qtyOnHand: number
  minLevel?: string | null
}

type Location = { id: string; code: string; locationType: string }
type Batch = { qtyOnHand: string; expiryDate?: string | null; item: { id: string; name: string; unit: string } }

export function PharmacyLowStockPanel() {
  const { data: configured = [], isError } = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: () => apiRequest<LowStockRow[]>('/inventory/alerts/low-stock'),
    retry: false,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const pharmacy = locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy')
  const { data: balances } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id],
    queryFn: () => apiRequest<{ batches: Batch[] }>(`/inventory/locations/${pharmacy!.id}/balances`),
    enabled: Boolean(pharmacy?.id),
  })

  const configuredReady = !isError && configured.some((row) => row.minLevel != null && Number(row.minLevel) > 0)

  const fallback = (() => {
    const qty = new Map<string, { name: string; unit: string; qty: number }>()
    const today = new Date().toISOString().slice(0, 10)
    for (const batch of balances?.batches ?? []) {
      if (batch.expiryDate && batch.expiryDate < today) continue
      const n = Number(batch.qtyOnHand)
      if (!Number.isFinite(n) || n <= 0) continue
      const current = qty.get(batch.item.id) ?? { name: batch.item.name, unit: batch.item.unit, qty: 0 }
      current.qty += n
      qty.set(batch.item.id, current)
    }
    return [...qty.values()].sort((a, b) => a.qty - b.qty)
  })()

  return (
    <Card className="p-6">
      <PageHeader title="Low stock" description="Pharmacy location only. Thresholds come from the backend when they exist." />
      {configuredReady ? (
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {configured.map((row) => (
            <li key={row.id} className="flex justify-between py-2">
              <span>{row.name}</span>
              <span className="tabular-nums">
                {row.qtyOnHand} {row.unit} · min {row.minLevel}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <Alert tone="warning" className="mt-4">
            Reorder thresholds are not configured on this live database. Showing current usable pharmacy stock only — this is not reorder intelligence.
          </Alert>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {fallback.map((row) => (
              <li key={row.name} className="flex justify-between py-2">
                <span>{row.name}</span>
                <span className="tabular-nums">
                  {row.qty} {row.unit}
                </span>
              </li>
            ))}
          </ul>
          {!fallback.length ? (
            <p className="mt-6 text-center text-sm text-slate-500">No stock has been recorded for this location.</p>
          ) : null}
        </>
      )}
    </Card>
  )
}
