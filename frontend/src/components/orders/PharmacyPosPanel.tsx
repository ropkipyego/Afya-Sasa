import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScanBarcode, ShoppingCart, Trash2 } from 'lucide-react'
import { Alert, Button, Card, Field, PageHeader } from '../ui'
import { PatientSearchAutocomplete, type PatientSearchItem } from '../PatientSearchAutocomplete'
import { apiRequest, formatApiError } from '../../lib/api'
import { notify } from '../../lib/notify'
import { formatConfiguredPrice } from '../../lib/clinical-catalog'
import { useAuthStore } from '../../lib/auth-store'
import { PharmacySalesPanel } from './PharmacySalesPanel'

type InventoryItem = {
  id: string
  sku: string
  name: string
  unit: string
  category: string
  sell?: number
}

type Location = { id: string; name: string; code: string }

type BalanceBatch = {
  id: string
  qtyOnHand: string
  availableQuantity?: number
  item: InventoryItem
}

type CartLine = { itemId: string; name: string; sku: string; unit: string; quantity: number; unitSell: number }

export function PharmacyPosPanel() {
  const queryClient = useQueryClient()
  const canDispense = useAuthStore((s) => (s.user?.permissions ?? []).includes('pharmacy:dispense'))
  const [patient, setPatient] = useState<PatientSearchItem | null>(null)
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [query, setQuery] = useState('')
  const [barcode, setBarcode] = useState('')
  const [notes, setNotes] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [saleId] = useState(() => crypto.randomUUID())
  const [prepared, setPrepared] = useState(false)

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items', 'pharmaceutical', 'pos'],
    queryFn: () => apiRequest<InventoryItem[]>('/inventory/items?category=pharmaceutical'),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })
  const pharmacy = locations.find((l) => l.code === 'PHARMACY')

  const { data: balances } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id, 'pos'],
    queryFn: () =>
      apiRequest<{ batches: BalanceBatch[] }>(`/inventory/locations/${pharmacy!.id}/balances`),
    enabled: Boolean(pharmacy?.id),
  })

  const availableByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const batch of balances?.batches ?? []) {
      const qty = Number(batch.availableQuantity ?? batch.qtyOnHand)
      if (qty <= 0) continue
      map.set(batch.item.id, (map.get(batch.item.id) ?? 0) + qty)
    }
    return map
  }, [balances])

  const priceByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      map.set(item.id, Number(item.sell ?? 0))
    }
    return map
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 40)
    return items
      .filter((item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q))
      .slice(0, 40)
  }, [items, query])

  const totals = cart.reduce(
    (acc, line) => {
      acc.qty += line.quantity
      acc.amount += line.quantity * line.unitSell
      return acc
    },
    { qty: 0, amount: 0 },
  )

  const addItem = (item: InventoryItem, qty = 1) => {
    const available = availableByItem.get(item.id) ?? 0
    const unitSell = Number(item.sell ?? priceByItem.get(item.id) ?? 0)
    if (unitSell <= 0) {
      notify('No selling price', `${item.name} has no catalogue sell price.`, 'warning')
      return
    }
    setCart((current) => {
      const existing = current.find((line) => line.itemId === item.id)
      const nextQty = (existing?.quantity ?? 0) + qty
      if (nextQty > available) {
        notify('Insufficient stock', `${item.name}: ${available} available after holds.`, 'warning')
        return current
      }
      if (existing) {
        return current.map((line) => (line.itemId === item.id ? { ...line, quantity: nextQty } : line))
      }
      return [...current, { itemId: item.id, name: item.name, sku: item.sku, unit: item.unit, quantity: qty, unitSell }]
    })
    setPrepared(false)
  }

  const scan = useMutation({
    mutationFn: () =>
      apiRequest<{ item: InventoryItem }>(`/inventory/barcode/${encodeURIComponent(barcode.trim())}`),
    onSuccess: (result) => {
      addItem(result.item)
      setBarcode('')
    },
    onError: (e: Error) => notify('Barcode not found', formatApiError(e, 'No matching SKU or batch.'), 'warning'),
  })

  const payload = () => ({
    saleId,
    patientId: patient?.id,
    walkInName: patient ? undefined : walkInName.trim() || undefined,
    walkInPhone: patient ? undefined : walkInPhone.trim() || undefined,
    notes: notes.trim() || undefined,
    lines: cart.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
  })

  const prepare = useMutation({
    mutationFn: () =>
      apiRequest<{ saleId: string; replay?: boolean }>('/inventory/sales/otc/prepare', {
        method: 'POST',
        body: JSON.stringify(payload()),
      }),
    onSuccess: async (result) => {
      setPrepared(true)
      notify(
        result.replay ? 'Sale already prepared' : 'Sent to cashier',
        `Sale ${result.saleId.slice(0, 8)}. Collect payment, then issue. Stock is held, not deducted.`,
        'success',
      )
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
    },
    onError: (e: Error) => notify('Could not prepare sale', formatApiError(e, 'Reservation failed.'), 'critical'),
  })

  const issue = useMutation({
    mutationFn: () =>
      apiRequest('/inventory/dispense/otc', {
        method: 'POST',
        body: JSON.stringify({ saleId, notes: notes.trim() || undefined, patientId: patient?.id }),
      }),
    onSuccess: async () => {
      notify('Issued', 'Reserved stock was deducted after clearance.', 'success')
      setCart([])
      setPrepared(false)
      setNotes('')
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
      await queryClient.invalidateQueries({ queryKey: ['payments-recent'] })
    },
    onError: (e: Error) => notify('Issue failed', formatApiError(e, 'Medicine was not issued.'), 'critical'),
  })

  const cancelSale = useMutation({
    mutationFn: () =>
      apiRequest('/inventory/sales/cancel', {
        method: 'POST',
        body: JSON.stringify({ saleId, reason: 'POS cancelled pending sale' }),
      }),
    onSuccess: async () => {
      notify('Hold released', 'No stock movement was posted.', 'success')
      setPrepared(false)
      await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
    },
    onError: (e: Error) => notify('Could not cancel', formatApiError(e, 'Cancel failed.'), 'critical'),
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="bg-gradient-to-br from-teal-900 to-slate-950 p-8 text-white">
        <PageHeader
          title="Pharmacy Sales POS"
          description="Walk-in or identified patient. Prepare reserves stock and opens a cashier bill. Issue only after payment or documented credit. Discounts and tax are not configured."
        />
        <p className="mt-3 font-mono text-sm text-teal-100">Sale {saleId}</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <h3 className="text-lg font-bold">Customer</h3>
          <p className="mt-1 text-sm text-slate-600">
            Patient is optional for eligible pharmaceutical OTC sales. Prescriptions stay on the pharmacy queue.
            There is no OTC-eligibility flag in the catalogue — only active pharmaceutical items can be sold here.
          </p>
          <div className="mt-4 space-y-3">
            <PatientSearchAutocomplete selected={patient} onSelect={setPatient} />
            {!patient ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  name="walkInName"
                  label="Walk-in name (optional on receipt)"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                />
                <Field
                  name="walkInPhone"
                  label="Walk-in phone (optional)"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          <h3 className="mt-8 text-lg font-bold">Products</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Field
              name="posSearch"
              label="Search name or SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex items-end gap-2">
              <Field
                name="barcode"
                label="Barcode / SKU / batch"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && barcode.trim()) scan.mutate()
                }}
              />
              <Button type="button" variant="secondary" loading={scan.isPending} onClick={() => scan.mutate()} disabled={!barcode.trim()}>
                <ScanBarcode className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
          <ul className="mt-4 max-h-64 overflow-auto divide-y divide-slate-100">
            {filtered.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {item.sku} · {availableByItem.get(item.id) ?? 0} {item.unit} available ·{' '}
                    {formatConfiguredPrice(Number(item.sell ?? 0)) ?? 'no price'}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => addItem(item)}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-teal-700" />
            Cart
          </h3>
          {cart.length ? (
            <ul className="mt-4 space-y-3">
              {cart.map((line) => (
                <li key={line.itemId} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold">{line.name}</p>
                    <button type="button" className="text-rose-700" onClick={() => setCart((c) => c.filter((row) => row.itemId !== line.itemId))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="font-mono text-xs text-slate-500">{line.sku}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <input
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1"
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => {
                        const quantity = Number(e.target.value)
                        setPrepared(false)
                        setCart((current) =>
                          current.map((row) => (row.itemId === line.itemId ? { ...row, quantity: quantity > 0 ? quantity : 1 } : row)),
                        )
                      }}
                    />
                    <span>{formatConfiguredPrice(line.quantity * line.unitSell)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-slate-500">Cart is empty.</p>
          )}
          <p className="mt-4 text-lg font-semibold">
            Total {formatConfiguredPrice(totals.amount) ?? '—'} · {totals.qty} units
          </p>
          <Field className="mt-3" name="posNotes" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {prepare.error ? <Alert tone="error">{formatApiError(prepare.error, 'Reservation failed.')}</Alert> : null}
          {issue.error ? <Alert tone="error">{formatApiError(issue.error, 'Issue failed.')}</Alert> : null}
          <p className="mt-3 text-xs text-slate-500">
            Cash, card, M-Pesa and receipts are the hospital cashier ledger. A click here does not collect money.
            Give the sale id to cashier if this is a walk-in.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              loading={prepare.isPending}
              disabled={!canDispense || !cart.length || prepare.isPending}
              onClick={() => prepare.mutate()}
            >
              Prepare / send to cashier
            </Button>
            <Button type="button" variant="secondary" loading={cancelSale.isPending} disabled={!prepared} onClick={() => cancelSale.mutate()}>
              Cancel hold
            </Button>
            <Button type="button" loading={issue.isPending} disabled={!canDispense || !prepared} onClick={() => issue.mutate()}>
              Issue after clearance
            </Button>
          </div>
        </Card>
      </div>

      <PharmacySalesPanel mode="all" />
    </div>
  )
}
