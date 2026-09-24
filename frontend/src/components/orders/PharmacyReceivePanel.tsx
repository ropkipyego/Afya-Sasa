import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Field, PageHeader, Select } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { drugClassLabel } from '../../lib/drug-class'

type Item = {
  id: string
  sku: string
  name: string
  unit: string
  category: string
  drugClass?: string | null
}
type Location = { id: string; name: string; code: string; locationType: string }

export function PharmacyReceivePanel() {
  const queryClient = useQueryClient()
  const [itemId, setItemId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [reason, setReason] = useState('')

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => apiRequest<Item[]>('/inventory/items'),
  })
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })

  const pharmacy = locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy')
  const item = items.find((row) => row.id === itemId)
  const expired = Boolean(expiryDate && expiryDate < new Date().toISOString().slice(0, 10))
  const qty = Number(quantity)

  const receive = useMutation({
    mutationFn: () => {
      if (expired) throw new Error('Expired batch cannot be received into usable stock.')
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be greater than zero.')
      return apiRequest('/inventory/receipts', {
        method: 'POST',
        body: JSON.stringify({
          itemId,
          locationId: locationId || pharmacy?.id,
          quantity: qty,
          batchNo: batchNo.trim() || undefined,
          expiryDate: expiryDate || undefined,
          reason: reason.trim() || undefined,
        }),
      })
    },
    onSuccess: async () => {
      notify('Stock received', 'This is a goods receipt, not a stock take. Ledger increased.', 'success')
      setQuantity('')
      setBatchNo('')
      setExpiryDate('')
      setReason('')
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
    },
    onError: (error: Error) => notify('Receipt failed', error.message, 'critical'),
  })

  return (
    <Card className="max-w-xl p-6">
      <PageHeader
        title="Receive stock"
        description="Supplier / transfer receipt. Do not use this to post a physical count — that is Stock take."
      />
      <div className="mt-4 space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Product</span>
          <Select className="mt-1" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Select product…</option>
            {items.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.sku}) · {drugClassLabel(row.drugClass)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Location</span>
          <Select className="mt-1" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Pharmacy (default)</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </Select>
        </label>
        <Field name="qty" label="Quantity" type="number" min={0.01} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Field name="batch" label="Batch" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
        <Field name="expiry" label="Expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        {expired ? (
          <Alert tone="error">Expired batch cannot be received as usable stock.</Alert>
        ) : null}
        <Field name="reason" label="Reference" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="GRN / supplier" />
        <Button
          type="button"
          disabled={!itemId || !quantity || expired || receive.isPending}
          loading={receive.isPending}
          onClick={() => {
            if (
              window.confirm(
                `Receive ${quantity} ${item?.unit ?? 'units'} of ${item?.name ?? 'this product'} into ${
                  locations.find((l) => l.id === (locationId || pharmacy?.id))?.name ?? 'pharmacy'
                }? This increases live stock.`,
              )
            ) {
              receive.mutate()
            }
          }}
        >
          Post receipt
        </Button>
      </div>
    </Card>
  )
}
