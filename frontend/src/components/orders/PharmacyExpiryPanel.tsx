import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'

type Location = { id: string; code: string; locationType: string; name: string }
type Batch = {
  id: string
  batchNo: string | null
  expiryDate: string | null
  qtyOnHand: string
  item: { name: string; sku: string; unit: string }
}

function daysUntil(expiry: string) {
  return Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000)
}

export function PharmacyExpiryPanel() {
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const pharmacy = locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy')
  const { data: balances, isLoading } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id],
    queryFn: () => apiRequest<{ batches: Batch[] }>(`/inventory/locations/${pharmacy!.id}/balances`),
    enabled: Boolean(pharmacy?.id),
  })

  const buckets = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const groups = {
      expired: [] as Batch[],
      d30: [] as Batch[],
      d60: [] as Batch[],
      d90: [] as Batch[],
    }
    for (const batch of balances?.batches ?? []) {
      if (!batch.expiryDate || Number(batch.qtyOnHand) <= 0) continue
      if (batch.expiryDate < today) {
        groups.expired.push(batch)
        continue
      }
      const days = daysUntil(batch.expiryDate)
      if (days <= 30) groups.d30.push(batch)
      else if (days <= 60) groups.d60.push(batch)
      else if (days <= 90) groups.d90.push(batch)
    }
    return groups
  }, [balances])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry monitor"
        description={`${pharmacy?.name ?? 'Pharmacy'} batches with remaining quantity. Expired stock is not usable for dispensing.`}
      />
      {isLoading ? <div className="h-40 animate-skeleton rounded-xl" /> : null}
      <Bucket title="Expired" rows={buckets.expired} tone="rose" />
      <Bucket title="0–30 days" rows={buckets.d30} tone="amber" />
      <Bucket title="31–60 days" rows={buckets.d60} />
      <Bucket title="61–90 days" rows={buckets.d90} />
    </div>
  )
}

function Bucket({
  title,
  rows,
  tone,
}: {
  title: string
  rows: Batch[]
  tone?: 'rose' | 'amber'
}) {
  return (
    <Card className={`p-5 ${tone === 'rose' ? 'border-rose-200' : tone === 'amber' ? 'border-amber-200' : ''}`}>
      <h3 className="text-sm font-semibold">
        {title} ({rows.length})
      </h3>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 py-2">
              <span>
                {row.item.name} · {row.batchNo ?? 'no batch'}
              </span>
              <span className="tabular-nums">
                {row.qtyOnHand} {row.item.unit} · {row.expiryDate}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">None in this window.</p>
      )}
    </Card>
  )
}
