import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Field, SelectField, TextareaField } from '../ui'
import { apiRequest } from '../../lib/api'
import { drugClassLabel } from '../../lib/drug-class'
import { notify } from '../../lib/notify'
import { lineValidationError, suggestDispenseQuantity } from '../../lib/prescription-quantity'

type CatalogItem = {
  id: string
  sku: string
  name: string
  unit: string
  strength?: string | null
  dosageForm?: string | null
  active?: boolean
  drugClass?: string | null
}

type Location = { id: string; code: string; locationType: string }
type BalanceBatch = { qtyOnHand: string; expiryDate?: string | null; item: { id: string } }

type DraftLine = {
  itemId: string
  medication: string
  unit: string
  dose: string
  route: string
  frequency: string
  duration: string
  unitsPerAdmin: string
  quantity: string
  quantityTouched: boolean
  instructions: string
  search: string
}

const emptyLine = (): DraftLine => ({
  itemId: '',
  medication: '',
  unit: '',
  dose: '',
  route: 'oral',
  frequency: '',
  duration: '',
  unitsPerAdmin: '',
  quantity: '',
  quantityTouched: false,
  instructions: '',
  search: '',
})

function newClientRequestId() {
  return `rx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function PrescriptionForm({
  patientId,
  encounterId,
  admissionId,
  onSuccess,
}: {
  patientId: string
  encounterId?: string
  admissionId?: string
  onSuccess?: () => void
}) {
  const queryClient = useQueryClient()
  const [priority, setPriority] = useState('routine')
  const [reviewing, setReviewing] = useState(false)
  const [clientRequestId, setClientRequestId] = useState(newClientRequestId)
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items', 'pharmaceutical'],
    queryFn: () =>
      apiRequest<CatalogItem[]>('/inventory/items?category=pharmaceutical&includeInactive=true'),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const pharmacy = locations.find((row) => row.code === 'PHARMACY' || row.locationType === 'pharmacy')
  const { data: balances } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id],
    queryFn: () => apiRequest<{ batches: BalanceBatch[] }>(`/inventory/locations/${pharmacy!.id}/balances`),
    enabled: Boolean(pharmacy?.id),
  })

  const stockByItem = useMemo(() => {
    const map = new Map<string, number>()
    const today = new Date().toISOString().slice(0, 10)
    for (const batch of balances?.batches ?? []) {
      const qty = Number(batch.qtyOnHand)
      if (!Number.isFinite(qty) || qty <= 0) continue
      if (batch.expiryDate && batch.expiryDate < today) continue
      map.set(batch.item.id, (map.get(batch.item.id) ?? 0) + qty)
    }
    return map
  }, [balances])

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line
        const next = { ...line, ...patch }
        if (!next.quantityTouched) {
          const suggestion = suggestDispenseQuantity({
            route: next.route,
            unit: next.unit,
            frequency: next.frequency,
            duration: next.duration,
            unitsPerAdmin: next.unitsPerAdmin,
          })
          if (suggestion.calculable && suggestion.quantity != null) {
            next.quantity = String(suggestion.quantity)
          }
        }
        return next
      }),
    )
  }

  const lineErrors = lines.map((line) => lineValidationError(line))
  const formError = lineErrors.find(Boolean) ?? (lines.length > 30 ? 'A prescription cannot exceed 30 lines.' : null)

  const order = useMutation({
    mutationFn: () => {
      if (formError) throw new Error(formError)
      const prepared = lines.map((line) => ({
        medication: line.medication.trim(),
        dose: line.dose.trim() || undefined,
        route: line.route.trim() || undefined,
        frequency: line.frequency.trim() || undefined,
        duration: line.duration.trim() || undefined,
        unitsPerAdmin: Number(line.unitsPerAdmin) || undefined,
        quantity: Number(line.quantity),
        itemId: line.itemId,
        instructions: line.instructions.trim() || undefined,
      }))
      return apiRequest('/clinical-orders/pharmacy/prescription', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          encounterId: encounterId || undefined,
          admissionId: admissionId || undefined,
          priority,
          clientRequestId,
          lines: prepared,
        }),
      })
    },
    onSuccess: async () => {
      notify(
        'Prescription sent',
        `${lines.length} medication ${lines.length === 1 ? 'line is' : 'lines are'} on the pharmacy queue.`,
        'success',
      )
      setLines([emptyLine()])
      setPriority('routine')
      setReviewing(false)
      setClientRequestId(newClientRequestId())
      await queryClient.invalidateQueries({ queryKey: ['clinical-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['consultation-pharmacy'] })
      await queryClient.invalidateQueries({ queryKey: ['ipd-pharmacy'] })
      onSuccess?.()
    },
    onError: (error: Error) => notify('Prescription failed', error.message, 'critical'),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (order.isPending) return
        if (formError) {
          notify('Check the prescription', formError, 'warning')
          return
        }
        if (!reviewing) {
          setReviewing(true)
          return
        }
        order.mutate()
      }}
    >
      <SelectField name="priority" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="routine">Routine</option>
        <option value="urgent">Urgent</option>
        <option value="stat">STAT</option>
      </SelectField>

      {lines.map((line, index) => {
        const item = items.find((row) => row.id === line.itemId)
        const stock = line.itemId ? stockByItem.get(line.itemId) : undefined
        const suggestion = suggestDispenseQuantity({
          route: line.route,
          unit: line.unit || item?.unit,
          frequency: line.frequency,
          duration: line.duration,
          unitsPerAdmin: line.unitsPerAdmin,
        })
        const matches = items.filter((row) => {
          const q = line.search.trim().toLowerCase()
          if (q.length < 2) return row.id === line.itemId
          return (
            row.name.toLowerCase().includes(q) ||
            row.sku.toLowerCase().includes(q) ||
            drugClassLabel(row.drugClass).toLowerCase().includes(q)
          )
        })
        return (
          <div key={index} className="space-y-3 rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">Line {index + 1}</p>
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <Field
              name={`catalogSearch-${index}`}
              label="Search catalogue"
              placeholder="Type 2+ letters…"
              value={line.search}
              onChange={(e) => updateLine(index, { search: e.target.value })}
            />
            <SelectField
              name={`itemId-${index}`}
              label="Approved product"
              required
              hint={
                item
                  ? [
                      item.sku,
                      item.strength,
                      item.dosageForm || item.unit,
                      drugClassLabel(item.drugClass),
                      stock == null
                        ? 'stock unknown'
                        : stock <= 0
                          ? 'out of stock — still prescribable'
                          : `${stock} in pharmacy`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Every line needs an exact catalogue product. Inactive products are listed but cannot be prescribed. Out-of-stock medicines stay visible.'
              }
              value={line.itemId}
              onChange={(e) => {
                const selected = items.find((row) => row.id === e.target.value)
                if (selected && selected.active === false) return
                updateLine(index, {
                  itemId: e.target.value,
                  medication: selected?.name ?? '',
                  unit: selected?.unit ?? selected?.dosageForm ?? '',
                  dose: line.dose || selected?.strength || '',
                })
              }}
            >
              <option value="">Select catalogue product…</option>
              {matches.slice(0, 80).map((row) => {
                const qty = stockByItem.get(row.id)
                const stockLabel =
                  qty == null ? '' : qty <= 0 ? ' · out of stock' : qty < 10 ? ` · low (${qty})` : ` · ${qty} in stock`
                const identity = [row.strength, row.dosageForm || row.unit].filter(Boolean).join(' ')
                return (
                  <option key={row.id} value={row.id} disabled={row.active === false}>
                    {row.name} {identity ? `· ${identity}` : ''} ({row.sku})
                    {row.active === false ? ' · INACTIVE' : stockLabel}
                  </option>
                )
              })}
            </SelectField>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Field
                name={`dose-${index}`}
                label="Strength / dose"
                placeholder="500 mg"
                required
                value={line.dose}
                onChange={(e) => updateLine(index, { dose: e.target.value })}
              />
              <SelectField
                name={`route-${index}`}
                label="Form / route"
                required
                value={line.route}
                onChange={(e) => updateLine(index, { route: e.target.value })}
              >
                <option value="oral">Oral / tablet</option>
                <option value="tablet">Tablet</option>
                <option value="capsule">Capsule</option>
                <option value="iv">IV</option>
                <option value="im">IM</option>
                <option value="sc">SC</option>
                <option value="topical">Topical</option>
                <option value="inhalation">Inhalation</option>
                <option value="other">Other</option>
              </SelectField>
              <Field
                name={`frequency-${index}`}
                label="Frequency"
                placeholder="TDS"
                required
                value={line.frequency}
                onChange={(e) => updateLine(index, { frequency: e.target.value })}
              />
              <Field
                name={`duration-${index}`}
                label="Duration"
                placeholder="5 days"
                value={line.duration}
                onChange={(e) => updateLine(index, { duration: e.target.value })}
              />
              <Field
                name={`unitsPerAdmin-${index}`}
                label="Units each time"
                type="number"
                min={0.01}
                step="any"
                placeholder="1"
                value={line.unitsPerAdmin}
                onChange={(e) => updateLine(index, { unitsPerAdmin: e.target.value })}
              />
              <Field
                name={`quantity-${index}`}
                label="Quantity"
                type="number"
                min={0.01}
                step="any"
                required
                value={line.quantity}
                onChange={(e) => updateLine(index, { quantity: e.target.value, quantityTouched: true })}
              />
            </div>
            <p className="text-xs text-slate-500">
              {item?.strength
                ? `Catalogue strength ${item.strength}${item.dosageForm ? ` · ${item.dosageForm}` : ''}. This is the product identity, not a dosing recommendation. `
                : ''}
              {suggestion.calculable
                ? `Suggested pack quantity ${suggestion.quantity} (${suggestion.reason}). Change it if the course differs.`
                : suggestion.reason}
            </p>
            {lineErrors[index] ? <p className="text-xs font-medium text-rose-700">{lineErrors[index]}</p> : null}
            <TextareaField
              name={`instructions-${index}`}
              label="Instructions"
              rows={2}
              value={line.instructions}
              onChange={(e) => updateLine(index, { instructions: e.target.value })}
              placeholder="Take after food…"
            />
          </div>
        )
      })}

      {reviewing ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 text-sm">
          <p className="font-semibold text-teal-950">Review before sending</p>
          <ul className="mt-2 space-y-1 text-teal-900">
            {lines.map((line, index) => (
              <li key={index}>
                {index + 1}. {line.medication || 'No product'} · {line.dose || 'no dose'} · {line.frequency || 'no frequency'} · qty{' '}
                {line.quantity || '—'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={lines.length >= 30}
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          Add medication
        </Button>
        {reviewing ? (
          <Button type="button" variant="secondary" onClick={() => setReviewing(false)}>
            Edit lines
          </Button>
        ) : null}
        <Button type="submit" loading={order.isPending} disabled={order.isPending}>
          {reviewing ? `Confirm and send ${lines.length} line${lines.length === 1 ? '' : 's'}` : 'Review prescription'}
        </Button>
      </div>
    </form>
  )
}
