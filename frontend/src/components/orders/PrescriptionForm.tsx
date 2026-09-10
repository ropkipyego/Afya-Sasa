import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Field, SelectField, TextareaField } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type CatalogItem = {
  id: string
  sku: string
  name: string
  unit: string
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
  const [itemId, setItemId] = useState('')
  const [medication, setMedication] = useState('')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState('oral')
  const [frequency, setFrequency] = useState('')
  const [quantity, setQuantity] = useState('')
  const [instructions, setInstructions] = useState('')
  const [priority, setPriority] = useState('routine')

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items', 'pharmaceutical'],
    queryFn: () => apiRequest<CatalogItem[]>('/inventory/items?category=pharmaceutical'),
  })

  useEffect(() => {
    const item = items.find((row) => row.id === itemId)
    if (item) setMedication(item.name)
  }, [itemId, items])

  const order = useMutation({
    mutationFn: () => {
      const name = medication.trim()
      if (!name) throw new Error('Enter or select a medication.')
      const qty = Number(quantity)
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Enter how many units pharmacy should issue.')
      return apiRequest('/clinical-orders/pharmacy', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          encounterId: encounterId || undefined,
          admissionId: admissionId || undefined,
          medication: name,
          dose: dose.trim() || undefined,
          route: route.trim() || undefined,
          frequency: frequency.trim() || undefined,
          quantity: qty,
          itemId: itemId || undefined,
          instructions: instructions.trim() || undefined,
          priority,
        }),
      })
    },
    onSuccess: async () => {
      notify('Prescription sent', `${medication.trim()} is on the pharmacy queue.`, 'success')
      setItemId('')
      setMedication('')
      setDose('')
      setFrequency('')
      setQuantity('')
      setInstructions('')
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
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        order.mutate()
      }}
    >
      <SelectField
        name="itemId"
        label="Stock item"
        hint="Pick from pharmacy catalogue when the drug is stocked."
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
      >
        <option value="">Free-text medication…</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} ({item.sku})
          </option>
        ))}
      </SelectField>
      <Field
        name="medication"
        label="Medication name"
        required
        placeholder="e.g. Amoxicillin"
        value={medication}
        onChange={(e) => {
          const next = e.target.value
          setMedication(next)
          const match = items.find(
            (row) => row.name.toLowerCase().trim() === next.toLowerCase().trim(),
          )
          setItemId(match?.id ?? '')
        }}
      />
      <Field name="dose" label="Dose" placeholder="e.g. 500 mg" value={dose} onChange={(e) => setDose(e.target.value)} />
      <SelectField name="route" label="Route" value={route} onChange={(e) => setRoute(e.target.value)}>
        <option value="oral">Oral</option>
        <option value="iv">IV</option>
        <option value="im">IM</option>
        <option value="sc">SC</option>
        <option value="topical">Topical</option>
        <option value="inhalation">Inhalation</option>
        <option value="other">Other</option>
      </SelectField>
      <Field
        name="frequency"
        label="Frequency / duration"
        placeholder="e.g. TDS × 5 days"
        value={frequency}
        onChange={(e) => setFrequency(e.target.value)}
      />
      <Field
        name="quantity"
        label="Quantity to issue"
        type="number"
        min={0.01}
        step="any"
        required
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        hint="Units pharmacy should give the patient."
      />
      <SelectField name="priority" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="routine">Routine</option>
        <option value="urgent">Urgent</option>
        <option value="stat">STAT</option>
      </SelectField>
      <div className="md:col-span-2">
        <TextareaField
          name="instructions"
          label="Instructions"
          rows={2}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Take after food, complete the course…"
        />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" loading={order.isPending} disabled={!medication.trim()}>
          Send to pharmacy
        </Button>
      </div>
    </form>
  )
}
