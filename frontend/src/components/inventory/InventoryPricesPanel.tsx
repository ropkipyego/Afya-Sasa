import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Field, PageHeader, Select } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { formatKes } from '../../lib/clinical-catalog'

type PricedItem = {
  id: string
  sku: string
  name: string
  category: string
  unit: string
  cost?: number
  markup?: number
  sell?: number
}

type Location = { id: string; name: string; code: string }

export function InventoryPricesPanel() {
  const queryClient = useQueryClient()
  const [locationId, setLocationId] = useState('')
  const [draft, setDraft] = useState<Record<string, { cost: string; markup: string; sell: string }>>({})

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => apiRequest<PricedItem[]>('/inventory/items'),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })

  const importCsv = useMutation({
    mutationFn: (csv: string) =>
      apiRequest<{ created: number; updated: number; received: number; priced: number; errors: string[] }>(
        '/inventory/items/import',
        { method: 'POST', body: JSON.stringify({ csv, locationId: locationId || undefined }) },
      ),
    onSuccess: async (summary) => {
      notify(
        'Stock file imported',
        `${summary.created} new · ${summary.updated} updated · ${summary.received} received · ${summary.priced} priced.`,
        summary.errors.length ? 'warning' : 'success',
      )
      if (summary.errors.length) {
        notify('Some rows failed', summary.errors.slice(0, 4).join(' · '), 'critical')
      }
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
    },
    onError: (error: Error) => notify('Import failed', error.message, 'critical'),
  })

  const savePrice = useMutation({
    mutationFn: ({ id, cost, markup, sell }: { id: string; cost: number; markup: number; sell: number }) =>
      apiRequest(`/inventory/items/${id}/pricing`, {
        method: 'PATCH',
        body: JSON.stringify({ cost, markup, sell }),
      }),
    onSuccess: async () => {
      notify('Price saved', 'Cashier and OTC now use this selling price.', 'success')
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
    },
    onError: (error: Error) => notify('Could not save price', error.message, 'critical'),
  })

  const rows = useMemo(
    () =>
      items.map((item) => {
        const local = draft[item.id]
        return {
          ...item,
          costInput: local?.cost ?? String(item.cost ?? 0),
          markupInput: local?.markup ?? String(item.markup ?? 0),
          sellInput: local?.sell ?? String(item.sell ?? 0),
        }
      }),
    [draft, items],
  )

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <PageHeader
          title="Upload stock & price list"
          description="CSV like QuickBooks item import: create or update SKUs, set cost/markup/sell, and optionally receive opening quantity."
        />
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="font-medium text-slate-700">Receive opening qty into</span>
            <Select className="mt-1 min-w-[14rem]" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Auto (pharmacy / main store)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const link = document.createElement('a')
              link.href = '/templates/inventory-stock-import-template.csv'
              link.download = 'inventory-stock-import-template.csv'
              link.click()
            }}
          >
            Download template
          </Button>
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                importCsv.mutate(await file.text())
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Columns: sku, name, category, unit, track_batch, cost, markup, sell, opening_qty, batch_no, expiry
        </p>
      </Card>

      <Card className="p-6">
        <PageHeader
          title="Price changes & markup"
          description="Cost is what the hospital paid. Markup % sets sell, or type sell and markup is calculated. Same amount the cashier sees."
        />
        {isLoading ? (
          <div className="mt-6 h-40 animate-skeleton rounded-xl" />
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-3">Item</th>
                  <th className="pb-3 pr-3">Cost</th>
                  <th className="pb-3 pr-3">Markup %</th>
                  <th className="pb-3 pr-3">Sell</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.sku} · {row.unit}
                      </p>
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
                            [row.id]: {
                              cost: e.target.value,
                              markup: row.markupInput,
                              sell: row.sellInput,
                            },
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
                        onClick={() =>
                          savePrice.mutate({
                            id: row.id,
                            cost: Number(row.costInput) || 0,
                            markup: Number(row.markupInput) || 0,
                            sell: Number(row.sellInput) || 0,
                          })
                        }
                      >
                        Save {formatKes(row.sellInput)}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No items yet. Upload the CSV template or add items when receiving stock.
              </p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}
