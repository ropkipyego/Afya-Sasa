import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Field, SelectField, TextareaField } from '../ui'
import { apiRequest } from '../../lib/api'
import { drugClassLabel } from '../../lib/drug-class'
import { notify } from '../../lib/notify'

type CatalogItem = {
  id: string
  sku: string
  name: string
  unit: string
  drugClass?: string | null
}

type DraftLine = {
  itemId: string
  medication: string
  dose: string
  route: string
  frequency: string
  duration: string
  quantity: string
  instructions: string
}

const emptyLine = (): DraftLine => ({
  itemId: '',
  medication: '',
  dose: '',
  route: 'oral',
  frequency: '',
  duration: '',
  quantity: '',
  instructions: '',
})

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
  const [catalogQuery, setCatalogQuery] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items', 'pharmaceutical'],
    queryFn: () => apiRequest<CatalogItem[]>('/inventory/items?category=pharmaceutical'),
  })

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const order = useMutation({
    mutationFn: () => {
      const prepared = lines.map((line) => {
        const name = line.medication.trim()
        const qty = Number(line.quantity)
        if (!name) throw new Error('Every line needs a medication name.')
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('Every line needs a quantity to issue.')
        return {
          medication: name,
          dose: line.dose.trim() || undefined,
          route: line.route.trim() || undefined,
          frequency: [line.frequency.trim(), line.duration.trim()].filter(Boolean).join(' × ') || undefined,
          quantity: qty,
          itemId: line.itemId || undefined,
          instructions: line.instructions.trim() || undefined,
        }
      })
      return apiRequest('/clinical-orders/pharmacy/prescription', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          encounterId: encounterId || undefined,
          admissionId: admissionId || undefined,
          priority,
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
      await queryClient.invalidateQueries({ queryKey: ['clinical-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['consultation-pharmacy'] })
      await queryClient.invalidateQueries({ queryKey: ['ipd-pharmacy'] })
      onSuccess?.()
    },
    onError: (error: Error) => notify('Prescription failed', error.message, 'critical'),
  })

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        order.mutate()
      }}
    >
      <SelectField name="priority" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="routine">Routine</option>
        <option value="urgent">Urgent</option>
        <option value="stat">STAT</option>
      </SelectField>

      {lines.map((line, index) => (
        <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Medication {index + 1}</p>
            {lines.length > 1 ? (
              <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                Remove line
              </Button>
            ) : null}
          </div>
          <div className="md:col-span-2">
            <Field
              name={`catalogSearch-${index}`}
              label="Search approved catalogue"
              placeholder="Type at least 2 letters…"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
            />
            <SelectField
              name={`itemId-${index}`}
              label="Stock item"
              hint={
                line.itemId
                  ? 'Linked to pharmacy stock. Dispensing will use this product.'
                  : 'Free-text is allowed but will not move stock until a catalogue item is linked.'
              }
              value={line.itemId}
              onChange={(e) => {
                const item = items.find((row) => row.id === e.target.value)
                updateLine(index, { itemId: e.target.value, medication: item?.name ?? line.medication })
              }}
            >
              <option value="">Free-text medication…</option>
              {items
                .filter((item) => {
                  const q = catalogQuery.trim().toLowerCase()
                  if (q.length < 2) return item.id === line.itemId
                  return (
                    item.name.toLowerCase().includes(q) ||
                    item.sku.toLowerCase().includes(q) ||
                    drugClassLabel(item.drugClass).toLowerCase().includes(q)
                  )
                })
                .slice(0, 80)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.sku}) · {drugClassLabel(item.drugClass)} · {item.unit}
                  </option>
                ))}
            </SelectField>
          </div>
          <Field
            name={`medication-${index}`}
            label="Medication name"
            required
            placeholder="e.g. Amoxicillin"
            value={line.medication}
            onChange={(e) => {
              const next = e.target.value
              const match = items.find((row) => row.name.toLowerCase().trim() === next.toLowerCase().trim())
              updateLine(index, { medication: next, itemId: match?.id ?? '' })
            }}
          />
          <Field name={`dose-${index}`} label="Strength / dose" placeholder="e.g. 500 mg" value={line.dose} onChange={(e) => updateLine(index, { dose: e.target.value })} />
          <SelectField name={`route-${index}`} label="Dosage form / route" value={line.route} onChange={(e) => updateLine(index, { route: e.target.value })}>
            <option value="oral">Oral / tablet</option>
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
            placeholder="e.g. TDS"
            value={line.frequency}
            onChange={(e) => updateLine(index, { frequency: e.target.value })}
          />
          <Field
            name={`duration-${index}`}
            label="Duration"
            placeholder="e.g. 5 days"
            value={line.duration}
            onChange={(e) => updateLine(index, { duration: e.target.value })}
          />
          <Field
            name={`quantity-${index}`}
            label="Quantity to issue"
            type="number"
            min={0.01}
            step="any"
            required
            value={line.quantity}
            onChange={(e) => updateLine(index, { quantity: e.target.value })}
          />
          <div className="md:col-span-2">
            <TextareaField
              name={`instructions-${index}`}
              label="Instructions"
              rows={2}
              value={line.instructions}
              onChange={(e) => updateLine(index, { instructions: e.target.value })}
              placeholder="Take after food, complete the course…"
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => setLines((current) => [...current, emptyLine()])}>
          Add medication
        </Button>
        <Button type="submit" loading={order.isPending}>
          Send {lines.length} {lines.length === 1 ? 'line' : 'lines'} to pharmacy
        </Button>
      </div>
    </form>
  )
}
