import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingBag } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader, SelectField } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'

type InventoryItem = {
  id: string
  sku: string
  name: string
  unit: string
  category: string
}

type Location = { id: string; name: string; code: string }

type BalanceBatch = {
  id: string
  batchNo: string
  qtyOnHand: string
  item: InventoryItem
}

export function PharmacyOtcPanel() {
  const queryClient = useQueryClient()
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items', 'pharmaceutical'],
    queryFn: () => apiRequest<InventoryItem[]>('/inventory/items?category=pharmaceutical'),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })

  const pharmacy = locations.find((l) => l.code === 'PHARMACY')

  const { data: balances } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id],
    queryFn: () => apiRequest<{ batches: BalanceBatch[] }>(`/inventory/locations/${pharmacy!.id}/balances`),
    enabled: Boolean(pharmacy?.id),
  })

  const stockByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const batch of balances?.batches ?? []) {
      const qty = Number(batch.qtyOnHand)
      if (qty <= 0) continue
      map.set(batch.item.id, (map.get(batch.item.id) ?? 0) + qty)
    }
    return map
  }, [balances])

  const sale = useMutation({
    mutationFn: () =>
      apiRequest('/inventory/dispense/otc', {
        method: 'POST',
        body: JSON.stringify({
          itemId,
          quantity: Number(quantity) || 1,
          patientId: patient?.id ?? undefined,
          notes: notes.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      notify('OTC sale recorded', 'Stock deducted from pharmacy ledger.', 'success')
      setQuantity('1')
      setNotes('')
      void queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] })
    },
    onError: (e: Error) => notify('Sale failed', e.message, 'critical'),
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-violet-900 to-indigo-950 p-8 text-white">
        <PageHeader
          title="OTC sales"
          description="Walk-in and over-the-counter sales — every unit sold is deducted from pharmacy stock."
        />
      </Card>

      <Card className="max-w-2xl p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <ShoppingBag className="h-5 w-5 text-teal-700" />
          Record sale
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Patient is optional for walk-ins. Stock is allocated FEFO from pharmacy batches.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Patient (optional)</p>
            <PatientSearchAutocomplete selected={patient} onSelect={setPatient} />
          </div>

          <SelectField
            name="itemId"
            label="Product"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            required
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.sku}) — {stockByItem.get(item.id) ?? 0} {item.unit} available
              </option>
            ))}
          </SelectField>

          <Field
            name="quantity"
            label="Quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />

          <Field
            name="notes"
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Walk-in customer"
          />

          {sale.error ? <Alert tone="error">{sale.error.message}</Alert> : null}

          <Button
            type="button"
            loading={sale.isPending}
            disabled={!itemId || !quantity}
            onClick={() => sale.mutate()}
          >
            Complete OTC sale
          </Button>
        </div>
      </Card>
    </div>
  )
}
