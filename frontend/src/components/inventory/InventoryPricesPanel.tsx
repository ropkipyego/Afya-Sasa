import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Field, PageHeader } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { formatConfiguredPrice, formatKes } from '../../lib/clinical-catalog'
import { drugClassLabel } from '../../lib/drug-class'

type PricedItem = {
  id: string
  sku: string
  name: string
  category: string
  drugClass?: string | null
  unit: string
  cost?: number
  markup?: number
  sell?: number
}

export function InventoryPricesPanel() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Record<string, { cost: string; markup: string; sell: string }>>({})
  const [query, setQuery] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => apiRequest<PricedItem[]>('/inventory/items'),
  })

  const savePrice = useMutation({
    mutationFn: ({ id, cost, markup, sell }: { id: string; cost: number; markup: number; sell: number }) =>
      apiRequest(`/inventory/items/${id}/pricing`, {
        method: 'PATCH',
        body: JSON.stringify({ cost, markup, sell }),
      }),
    onSuccess: async () => {
      notify('Price saved', 'Cashier and pharmacy now use this selling price.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
    },
    onError: (error: Error) => notify('Could not save price', error.message, 'critical'),
  })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((item) => {
        if (!q) return true
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.drugClass ?? '').toLowerCase().includes(q)
        )
      })
      .map((item) => {
        const local = draft[item.id]
        return {
          ...item,
          costInput: local?.cost ?? String(item.cost ?? 0),
          markupInput: local?.markup ?? String(item.markup ?? 0),
          sellInput: local?.sell ?? String(item.sell ?? 0),
        }
      })
  }, [draft, items, query])

  return (
    <Card className="p-6">
      <PageHeader
        title="Selling prices"
        description="Change one product at a time. The hospital count sheet and drug template are under Stock take, not here."
      />
      <input
        className="input mt-4 max-w-md"
        placeholder="Search product, SKU, or class…"
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
                <th className="pb-3 pr-3">Product</th>
                <th className="pb-3 pr-3">Current sell</th>
                <th className="pb-3 pr-3">Cost</th>
                <th className="pb-3 pr-3">Markup %</th>
                <th className="pb-3 pr-3">New sell</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.sku} · {row.unit} · {drugClassLabel(row.drugClass)}
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-sm font-medium">
                    {formatConfiguredPrice(row.sell) ?? (
                      <span className="text-amber-800">No price configured</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <Field
                      name={`cost-${row.id}`}
                      label=""
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      value={row.costInput}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          [row.id]: { cost: e.target.value, markup: row.markupInput, sell: row.sellInput },
                        }))
                      }
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Field
                      name={`markup-${row.id}`}
                      label=""
                      type="number"
                      step="0.01"
                      className="w-24"
                      value={row.markupInput}
                      onChange={(e) => {
                        const markup = Number(e.target.value)
                        const cost = Number(row.costInput)
                        const sell =
                          Number.isFinite(cost) && Number.isFinite(markup)
                            ? String(Math.round(cost * (1 + markup / 100) * 100) / 100)
                            : row.sellInput
                        setDraft((current) => ({
                          ...current,
                          [row.id]: { cost: row.costInput, markup: e.target.value, sell },
                        }))
                      }}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Field
                      name={`sell-${row.id}`}
                      label=""
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      value={row.sellInput}
                      onChange={(e) => {
                        const sell = Number(e.target.value)
                        const cost = Number(row.costInput)
                        const markup =
                          Number.isFinite(cost) && cost > 0 && Number.isFinite(sell)
                            ? String(Math.round(((sell - cost) / cost) * 10000) / 100)
                            : row.markupInput
                        setDraft((current) => ({
                          ...current,
                          [row.id]: { cost: row.costInput, markup, sell: e.target.value },
                        }))
                      }}
                    />
                  </td>
                  <td className="py-3">
                    <Button
                      type="button"
                      variant="secondary"
                      loading={savePrice.isPending}
                      onClick={() => {
                        const next = Number(row.sellInput) || 0
                        const current = Number(row.sell ?? 0)
                        if (
                          !window.confirm(
                            `Change ${row.name} selling price from ${formatConfiguredPrice(current) ?? 'no price'} to ${formatKes(next)}?`,
                          )
                        ) {
                          return
                        }
                        savePrice.mutate({
                          id: row.id,
                          cost: Number(row.costInput) || 0,
                          markup: Number(row.markupInput) || 0,
                          sell: next,
                        })
                      }}
                    >
                      Save
                    </Button>
                  </td>
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
