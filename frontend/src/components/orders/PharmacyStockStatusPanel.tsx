import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Card, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { drugClassLabel } from '../../lib/drug-class'
import { formatConfiguredPrice } from '../../lib/clinical-catalog'

type Location = { id: string; name: string; code: string; locationType: string }
type Batch = {
  id: string
  batchNo: string | null
  expiryDate: string | null
  qtyOnHand: string
  item: { id: string; sku: string; name: string; unit: string; drugClass?: string | null; sell?: number }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(expiry: string) {
  return Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000)
}

export function PharmacyStockStatusPanel() {
  const [query, setQuery] = useState('')
  const [openItemId, setOpenItemId] = useState<string | null>(null)

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const pharmacy = locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy')
  const { data: balances, isLoading, error } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id],
    queryFn: () => apiRequest<{ batches: Batch[] }>(`/inventory/locations/${pharmacy!.id}/balances`),
    enabled: Boolean(pharmacy?.id),
  })

  const products = useMemo(() => {
    const map = new Map<
      string,
      {
        item: Batch['item']
        usable: number
        expired: number
        nearest?: string
        batches: Batch[]
      }
    >()
    const today = todayIso()
    for (const batch of balances?.batches ?? []) {
      const qty = Number(batch.qtyOnHand)
      if (!Number.isFinite(qty) || qty <= 0) continue
      const current = map.get(batch.item.id) ?? {
        item: batch.item,
        usable: 0,
        expired: 0,
        nearest: undefined as string | undefined,
        batches: [] as Batch[],
      }
      const expired = Boolean(batch.expiryDate && batch.expiryDate < today)
      if (expired) current.expired += qty
      else current.usable += qty
      if (!expired && batch.expiryDate && (!current.nearest || batch.expiryDate < current.nearest)) {
        current.nearest = batch.expiryDate
      }
      current.batches.push(batch)
      map.set(batch.item.id, current)
    }
    return [...map.values()]
  }, [balances])

  const rows = products.filter((row) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return row.item.name.toLowerCase().includes(q) || row.item.sku.toLowerCase().includes(q)
  })

  return (
    <Card className="p-6">
      <PageHeader
        title="Pharmacy stock"
        description={`${pharmacy?.name ?? 'PHARMACY'} · expired lots are listed separately and are not usable for dispensing.`}
      />
      {!pharmacy ? (
        <Alert tone="warning" className="mt-4">
          Pharmacy location is not configured.
        </Alert>
      ) : null}
      {error ? <Alert tone="error" className="mt-4">{(error as Error).message}</Alert> : null}
      <input
        className="input mt-4 max-w-md"
        placeholder="Search product…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isLoading ? (
        <div className="mt-6 h-40 animate-skeleton rounded-xl" />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3">Product</th>
                <th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">Usable</th>
                <th className="pb-2 pr-3">Expired</th>
                <th className="pb-2 pr-3">Nearest expiry</th>
                <th className="pb-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const nearestDays = row.nearest ? daysUntil(row.nearest) : null
                const status =
                  row.usable <= 0
                    ? 'OUT OF STOCK'
                    : nearestDays != null && nearestDays <= 30
                      ? 'EXPIRING SOON'
                      : row.usable <= 10
                        ? 'LOW STOCK'
                        : 'IN STOCK'
                return (
                  <tr
                    key={row.item.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => setOpenItemId(openItemId === row.item.id ? null : row.item.id)}
                  >
                    <td className="py-2 pr-3">
                      <p className="font-medium">{row.item.name}</p>
                      <p className="text-xs text-slate-500">{drugClassLabel(row.item.drugClass)}</p>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.item.sku}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.usable} {row.item.unit}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-rose-800">
                      {row.expired ? `${row.expired} ${row.item.unit}` : '—'}
                    </td>
                    <td className="py-2 pr-3">{row.nearest ?? '—'}</td>
                    <td className="py-2 pr-3 text-xs font-semibold">{status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No stock has been recorded for this location.
            </p>
          ) : null}
        </div>
      )}
      {openItemId
        ? rows
            .filter((row) => row.item.id === openItemId)
            .map((row) => (
              <div key={row.item.id} className="mt-4 rounded-xl border border-slate-200 p-4">
                <p className="font-semibold">{row.item.name} batches</p>
                <p className="text-xs text-slate-500">
                  Sell {formatConfiguredPrice(row.item.sell) ?? 'not configured'}
                </p>
                <table className="mt-3 w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-slate-500">
                      <th className="pb-2">Batch</th>
                      <th className="pb-2">Expiry</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.batches.map((batch) => {
                      const expired = Boolean(batch.expiryDate && batch.expiryDate < todayIso())
                      const soon = Boolean(
                        batch.expiryDate && !expired && daysUntil(batch.expiryDate) <= 30,
                      )
                      return (
                        <tr key={batch.id} className="border-t border-slate-100">
                          <td className="py-1">{batch.batchNo ?? '—'}</td>
                          <td className="py-1">{batch.expiryDate ?? '—'}</td>
                          <td className="py-1">{batch.qtyOnHand}</td>
                          <td className="py-1 text-xs font-semibold">
                            {expired ? 'EXPIRED' : soon ? 'EXPIRING SOON' : 'AVAILABLE'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))
        : null}
    </Card>
  )
}
