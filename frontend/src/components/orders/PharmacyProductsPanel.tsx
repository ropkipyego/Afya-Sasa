import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, PageHeader, SelectField } from '../ui'
import { apiRequest } from '../../lib/api'
import { formatConfiguredPrice } from '../../lib/clinical-catalog'
import { drugClassLabel } from '../../lib/drug-class'

type Product = {
  id: string
  sku: string
  name: string
  category: string
  drugClass?: string | null
  unit: string
  sell?: number
  active?: boolean
}

type Location = { id: string; code: string; locationType: string }
type Batch = { qtyOnHand: string; expiryDate?: string | null; item: { id: string } }

export function PharmacyProductsPanel() {
  const [query, setQuery] = useState('')
  const [drugClass, setDrugClass] = useState('')

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => apiRequest<Product[]>('/inventory/items'),
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

  const qtyByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const batch of balances?.batches ?? []) {
      const qty = Number(batch.qtyOnHand)
      if (!Number.isFinite(qty) || qty <= 0) continue
      if (batch.expiryDate && batch.expiryDate < new Date().toISOString().slice(0, 10)) continue
      map.set(batch.item.id, (map.get(batch.item.id) ?? 0) + qty)
    }
    return map
  }, [balances])

  const classes = useMemo(
    () => [...new Set(items.map((item) => item.drugClass).filter(Boolean))] as string[],
    [items],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (drugClass && item.drugClass !== drugClass) return false
      if (!q) return true
      return item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)
    })
  }, [drugClass, items, query])

  return (
    <Card className="p-6">
      <PageHeader
        title="Products"
        description="Medication master from the inventory catalogue. Therapeutic class comes from the backend."
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="input"
          placeholder="Search name or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SelectField name="drugClass" label="" value={drugClass} onChange={(e) => setDrugClass(e.target.value)}>
          <option value="">All classes</option>
          {classes.map((value) => (
            <option key={value} value={value}>
              {drugClassLabel(value)}
            </option>
          ))}
        </SelectField>
      </div>
      {error ? <p className="mt-4 text-sm text-rose-700">{(error as Error).message}</p> : null}
      {isLoading ? (
        <div className="mt-6 h-40 animate-skeleton rounded-xl" />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3">Product</th>
                <th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">Class</th>
                <th className="pb-2 pr-3">Unit</th>
                <th className="pb-2 pr-3">Sell</th>
                <th className="pb-2 pr-3 text-right">Usable stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium">{item.name}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{item.sku}</td>
                  <td className="py-2 pr-3">{drugClassLabel(item.drugClass)}</td>
                  <td className="py-2 pr-3">{item.unit}</td>
                  <td className="py-2 pr-3">
                    {formatConfiguredPrice(item.sell) ?? (
                      <span className="text-amber-800">No price configured</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{qtyByItem.get(item.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No pharmacy products have been imported yet.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  )
}
