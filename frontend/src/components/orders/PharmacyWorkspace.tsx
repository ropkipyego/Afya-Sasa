import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Field, SelectField } from '../ui'
import { apiRequest } from '../../lib/api'
import { notify } from '../../lib/notify'
import { formatPatientNoShort } from '../../lib/patient-utils'
import { openPatientFile } from '../../lib/patient-file'
import {
  LabEmptyState,
  LabModal,
  LabPatientStrip,
  LabQueueItem,
  LabSection,
  waitLabel,
} from '../investigations/lab-ui'

type PharmacyOrder = {
  id: string
  orderNo: string
  status: string
  priority: string
  orderedAt: string
  patient?: { id?: string; firstName: string; lastName: string; patientNo: string }
  metadata?: {
    medication?: string
    dose?: string
    route?: string
    frequency?: string
    itemId?: string | null
    quantity?: number | string | null
    instructions?: string | null
  } | null
}

type CatalogItem = { id: string; sku: string; name: string; unit: string; category: string }
type Location = { id: string; code: string; locationType: string }
type BalanceBatch = { qtyOnHand: string; item: { id: string } }

function normalizeMedName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function metaQty(order: PharmacyOrder) {
  const qty = Number(order.metadata?.quantity)
  return Number.isFinite(qty) && qty > 0 ? String(qty) : ''
}

function matchCatalogItem(items: CatalogItem[], order: PharmacyOrder) {
  const prescribed = order.metadata?.itemId
  if (prescribed && items.some((item) => item.id === prescribed)) {
    return prescribed
  }
  const name = normalizeMedName(order.metadata?.medication ?? '')
  if (!name) return ''
  const exact = items.find(
    (item) => normalizeMedName(item.name) === name || normalizeMedName(item.sku) === name,
  )
  if (exact) return exact.id
  const partial = items.filter((item) => {
    const hay = normalizeMedName(item.name)
    return hay.includes(name) || name.includes(hay)
  })
  return partial.length === 1 ? partial[0].id : ''
}

function scriptLine(order: PharmacyOrder) {
  return [
    order.metadata?.medication,
    order.metadata?.dose,
    order.metadata?.frequency,
    order.metadata?.quantity != null ? `qty ${order.metadata.quantity}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function PharmacyWorkspace() {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [itemId, setItemId] = useState('')
  const [dispenseQty, setDispenseQty] = useState('1')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['clinical-orders', 'pharmacy'],
    queryFn: () => apiRequest<PharmacyOrder[]>('/clinical-orders?module=pharmacy&limit=100'),
    refetchInterval: 20_000,
  })

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items', 'pharmaceutical'],
    queryFn: () => apiRequest<CatalogItem[]>('/inventory/items?category=pharmaceutical'),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => apiRequest<Location[]>('/inventory/locations'),
  })

  const pharmacy = locations.find((l) => l.code === 'PHARMACY' || l.locationType === 'pharmacy')

  const { data: balances } = useQuery({
    queryKey: ['inventory-balances', pharmacy?.id],
    queryFn: () => apiRequest<{ batches: BalanceBatch[] }>(`/inventory/locations/${pharmacy!.id}/balances`),
    enabled: Boolean(pharmacy?.id),
  })

  const pending = orders.filter((o) => o.status !== 'dispensed' && o.status !== 'cancelled')
  const active = pending.find((o) => o.id === activeId) ?? null

  const stockByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const batch of balances?.batches ?? []) {
      const qty = Number(batch.qtyOnHand)
      if (!Number.isFinite(qty) || qty <= 0) continue
      map.set(batch.item.id, (map.get(batch.item.id) ?? 0) + qty)
    }
    return map
  }, [balances])

  useEffect(() => {
    if (!active) return
    setDispenseQty(metaQty(active))
    setItemId(matchCatalogItem(items, active))
  }, [active?.id, items])

  const selectedItem = items.find((item) => item.id === itemId)
  const available = itemId ? (stockByItem.get(itemId) ?? 0) : 0
  const needed = Number(dispenseQty)
  const stockKnown = Boolean(pharmacy?.id && balances)

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['clinical-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['consultation-pharmacy'] }),
      queryClient.invalidateQueries({ queryKey: ['ipd-pharmacy'] }),
    ])
  }

  const dispense = useMutation({
    mutationFn: () => {
      if (!active) throw new Error('Select a prescription.')
      if (!itemId) throw new Error('Select the stock item to issue.')
      if (!Number.isFinite(needed) || needed <= 0) throw new Error('Enter how many units to issue.')
      return apiRequest<{ item?: { name?: string }; quantity?: number }>('/inventory/dispense/pharmacy', {
        method: 'POST',
        body: JSON.stringify({
          clinicalOrderId: active.id,
          itemId,
          quantity: needed,
        }),
      })
    },
    onSuccess: async (result) => {
      notify(
        'Dispensed',
        `${result.item?.name ?? selectedItem?.name ?? 'Medication'} · ${result.quantity ?? needed} issued FEFO.`,
        'success',
      )
      setActiveId(null)
      await invalidate()
    },
    onError: (e: Error) => notify('Dispense failed', e.message, 'critical'),
  })

  return (
    <div className="space-y-6">
      <LabSection
        title="Prescription queue"
        description={`${pending.length} awaiting dispense. Click a script, confirm the stock item and quantity, then issue.`}
      >
        {isLoading ? (
          <div className="h-48 animate-skeleton rounded-2xl" />
        ) : pending.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pending.map((order) => (
              <LabQueueItem
                key={order.id}
                active={activeId === order.id}
                onClick={() => setActiveId(order.id)}
                name={
                  order.patient
                    ? `${order.patient.firstName} ${order.patient.lastName}`
                    : 'Unknown patient'
                }
                patientNo={
                  order.patient?.patientNo
                    ? formatPatientNoShort(order.patient.patientNo)
                    : order.orderNo
                }
                status={order.status}
                priority={order.priority}
                wait={waitLabel(order.orderedAt)}
                subtitle={scriptLine(order) || order.orderNo}
              />
            ))}
          </div>
        ) : (
          <LabEmptyState title="Queue is clear" description="No pending prescriptions." />
        )}
      </LabSection>

      {active ? (
        <LabModal
          wide
          title="Dispense prescription"
          description={`${active.orderNo} — issue from the PHARMACY location using FEFO.`}
          onClose={() => setActiveId(null)}
        >
          <div className="space-y-5">
            <LabPatientStrip
              firstName={active.patient?.firstName}
              lastName={active.patient?.lastName}
              patientNo={
                active.patient?.patientNo ? formatPatientNoShort(active.patient.patientNo) : undefined
              }
              status={active.status}
              priority={active.priority}
              wait={waitLabel(active.orderedAt)}
            />
            {active.patient?.id ? (
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-2 text-xs"
                onClick={() => openPatientFile(active.patient!.id!)}
              >
                Open patient file
              </Button>
            ) : null}

            <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
              <p className="font-semibold">{active.metadata?.medication ?? 'Medication'}</p>
              <p className="mt-1 text-teal-900">
                {[active.metadata?.dose, active.metadata?.route, active.metadata?.frequency]
                  .filter(Boolean)
                  .join(' · ') || 'No dose / frequency recorded'}
              </p>
              {active.metadata?.instructions ? (
                <p className="mt-2 text-sm">{active.metadata.instructions}</p>
              ) : null}
            </div>

            <SelectField
              name="itemId"
              label="Stock item to issue"
              required
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              hint={!pharmacy ? 'Pharmacy location is not configured.' : undefined}
            >
              <option value="">Select stock item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku}) · {stockByItem.get(item.id) ?? 0} {item.unit} on hand
                </option>
              ))}
            </SelectField>

            <Field
              name="dispenseQty"
              label={selectedItem ? `Quantity (${selectedItem.unit})` : 'Quantity to issue'}
              type="number"
              min={0.01}
              step="any"
              required
              value={dispenseQty}
              onChange={(e) => setDispenseQty(e.target.value)}
              hint={
                !dispenseQty
                  ? 'This script has no quantity — enter how many units to issue.'
                  : itemId
                    ? `${available} on hand at pharmacy`
                    : 'Select an item to see stock.'
              }
            />

            {itemId && stockKnown && needed > available ? (
              <p className="text-sm font-medium text-rose-700">
                Not enough stock. Need {needed}, have {available}. Receive stock or transfer from store first.
              </p>
            ) : null}

            <Button
              type="button"
              loading={dispense.isPending}
              disabled={!itemId || !needed || needed <= 0 || (stockKnown && needed > available)}
              onClick={() => dispense.mutate()}
            >
              Dispense from pharmacy stock
            </Button>
          </div>
        </LabModal>
      ) : null}
    </div>
  )
}
