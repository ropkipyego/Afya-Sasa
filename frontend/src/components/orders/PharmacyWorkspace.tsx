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
  encounter?: { id?: string } | null
  metadata?: {
    kind?: string
    parentOrderId?: string
    prescriptionGroupId?: string
    medication?: string
    dose?: string
    route?: string
    frequency?: string
    itemId?: string | null
    quantity?: number | string | null
    quantityPrescribed?: number | string | null
    quantityDispensed?: number | string | null
    dispensedQuantity?: number | string | null
    instructions?: string | null
  } | null
}

type CatalogItem = { id: string; sku: string; name: string; unit: string; category: string; sell?: number }
type Location = { id: string; code: string; locationType: string }
type BalanceBatch = { qtyOnHand: string; expiryDate?: string | null; batchNo?: string; item: { id: string } }

type LineDraft = {
  clinicalOrderId: string
  itemId: string
  quantity: string
  rejected: boolean
}

function groupId(order: PharmacyOrder) {
  return String(order.metadata?.prescriptionGroupId ?? order.metadata?.parentOrderId ?? order.id)
}

function prescribedQty(order: PharmacyOrder) {
  return Number(order.metadata?.quantityPrescribed ?? order.metadata?.quantity ?? 0)
}

function dispensedQty(order: PharmacyOrder) {
  return Number(order.metadata?.quantityDispensed ?? order.metadata?.dispensedQuantity ?? 0)
}

function remainingQty(order: PharmacyOrder) {
  const prescribed = prescribedQty(order)
  if (!Number.isFinite(prescribed) || prescribed <= 0) return null
  return Math.max(0, prescribed - dispensedQty(order))
}

function matchCatalogItem(items: CatalogItem[], order: PharmacyOrder) {
  const prescribed = order.metadata?.itemId
  if (prescribed && items.some((item) => item.id === prescribed)) return prescribed
  const name = (order.metadata?.medication ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!name) return ''
  const exact = items.find(
    (item) => item.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === name,
  )
  return exact?.id ?? ''
}

function scriptLine(order: PharmacyOrder) {
  return [order.metadata?.medication, order.metadata?.dose, order.metadata?.frequency].filter(Boolean).join(' · ')
}

export function PharmacyWorkspace() {
  const queryClient = useQueryClient()
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<LineDraft[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

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

  const stockByItem = useMemo(() => {
    const map = new Map<string, { qty: number; batchNo?: string; expiry?: string | null }>()
    for (const batch of balances?.batches ?? []) {
      const qty = Number(batch.qtyOnHand)
      if (!Number.isFinite(qty) || qty <= 0) continue
      const current = map.get(batch.item.id)
      map.set(batch.item.id, {
        qty: (current?.qty ?? 0) + qty,
        batchNo: current?.batchNo ?? batch.batchNo,
        expiry: current?.expiry ?? batch.expiryDate,
      })
    }
    return map
  }, [balances])

  const groups = useMemo(() => {
    const map = new Map<string, PharmacyOrder[]>()
    for (const order of orders) {
      if (order.metadata?.kind === 'prescription') continue
      if (order.status === 'cancelled' || remainingQty(order) === 0 || order.status === 'dispensed') continue
      const id = groupId(order)
      const list = map.get(id) ?? []
      list.push(order)
      map.set(id, list)
    }
    return [...map.entries()].map(([id, lines]) => ({
      id,
      lines,
      first: lines[0],
      waiting: lines.some((line) => line.status !== 'dispensed'),
    }))
  }, [orders])

  const active = groups.find((group) => group.id === activeGroupId) ?? null

  useEffect(() => {
    if (!active) {
      setDrafts([])
      setConfirmOpen(false)
      return
    }
    setDrafts(
      active.lines.map((line) => ({
        clinicalOrderId: line.id,
        itemId: matchCatalogItem(items, line),
        quantity: String(remainingQty(line) ?? (prescribedQty(line) || '')),
        rejected: false,
      })),
    )
    setConfirmOpen(false)
  }, [active?.id, items])

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['clinical-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['consultation-pharmacy'] }),
      queryClient.invalidateQueries({ queryKey: ['ipd-pharmacy'] }),
    ])
  }

  const selectedLines = drafts.filter((draft) => !draft.rejected)
  const totals = selectedLines.reduce(
    (acc, draft) => {
      const item = items.find((row) => row.id === draft.itemId)
      const qty = Number(draft.quantity)
      const unit = Number(item?.sell ?? 0)
      acc.items += 1
      acc.qty += Number.isFinite(qty) ? qty : 0
      acc.amount += Number.isFinite(qty) && unit > 0 ? qty * unit : 0
      return acc
    },
    { items: 0, qty: 0, amount: 0 },
  )

  const dispense = useMutation({
    mutationFn: () => {
      if (!active) throw new Error('Select a prescription.')
      if (!confirmOpen) throw new Error('Review the confirmation before committing.')
      const lines = selectedLines.map((draft) => {
        const qty = Number(draft.quantity)
        if (!draft.itemId) throw new Error('Select a stock item for every line you will issue.')
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('Enter a quantity for every issued line.')
        return { clinicalOrderId: draft.clinicalOrderId, itemId: draft.itemId, quantity: qty }
      })
      if (!lines.length) throw new Error('Select at least one line to dispense.')
      return apiRequest<{ billing?: { suggestedAmount?: number | null; description?: string } }>(
        '/inventory/dispense/prescription',
        {
          method: 'POST',
          body: JSON.stringify({
            confirm: true,
            prescriptionGroupId: active.id,
            lines,
          }),
        },
      )
    },
    onSuccess: async (result) => {
      notify(
        'Dispensed',
        `${result.billing?.description ?? `${totals.items} line(s)`} issued FEFO. Collect payment on the cashier desk.`,
        'success',
      )
      setActiveGroupId(null)
      await invalidate()
    },
    onError: (e: Error) => notify('Dispense failed', e.message, 'critical'),
  })

  return (
    <div className="space-y-6">
      <LabSection
        title="Prescription queue"
        description={`${groups.length} waiting. Open one prescription to process every medication line together.`}
      >
        {isLoading ? (
          <div className="h-48 animate-skeleton rounded-2xl" />
        ) : groups.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <LabQueueItem
                key={group.id}
                active={activeGroupId === group.id}
                onClick={() => setActiveGroupId(group.id)}
                name={
                  group.first.patient
                    ? `${group.first.patient.firstName} ${group.first.patient.lastName}`
                    : 'Unknown patient'
                }
                patientNo={
                  group.first.patient?.patientNo
                    ? formatPatientNoShort(group.first.patient.patientNo)
                    : group.first.orderNo
                }
                status={group.lines.some((line) => line.status === 'partially_dispensed') ? 'partial' : group.first.status}
                priority={group.first.priority}
                wait={waitLabel(group.first.orderedAt)}
                subtitle={`${group.lines.length} line${group.lines.length === 1 ? '' : 's'} · ${group.lines.map((line) => line.metadata?.medication).filter(Boolean).join(', ')}`}
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
          description={`${active.first.orderNo} — review every line, then confirm once. Stock is deducted only after confirm.`}
          onClose={() => setActiveGroupId(null)}
        >
          <div className="space-y-5">
            <LabPatientStrip
              firstName={active.first.patient?.firstName}
              lastName={active.first.patient?.lastName}
              patientNo={
                active.first.patient?.patientNo ? formatPatientNoShort(active.first.patient.patientNo) : undefined
              }
              status={active.first.status}
              priority={active.first.priority}
              wait={waitLabel(active.first.orderedAt)}
            />
            {active.first.patient?.id ? (
              <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => openPatientFile(active.first.patient!.id!)}>
                Open patient file
              </Button>
            ) : null}

            <div className="space-y-4">
              {active.lines.map((line) => {
                const draft = drafts.find((row) => row.clinicalOrderId === line.id)
                if (!draft) return null
                const item = items.find((row) => row.id === draft.itemId)
                const stock = draft.itemId ? stockByItem.get(draft.itemId) : undefined
                const qty = Number(draft.quantity)
                const remaining = remainingQty(line)
                return (
                  <div key={line.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{scriptLine(line) || line.orderNo}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Prescribed {prescribedQty(line) || '—'} · already issued {dispensedQty(line)} · remaining{' '}
                          {remaining ?? '—'}
                        </p>
                      </div>
                      <label className="text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          className="mr-1"
                          checked={draft.rejected}
                          onChange={(e) =>
                            setDrafts((current) =>
                              current.map((row) =>
                                row.clinicalOrderId === line.id ? { ...row, rejected: e.target.checked } : row,
                              ),
                            )
                          }
                        />
                        Hold line
                      </label>
                    </div>
                    {draft.rejected ? null : (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <SelectField
                          name={`item-${line.id}`}
                          label="Stock item / FEFO batch"
                          required
                          value={draft.itemId}
                          onChange={(e) =>
                            setDrafts((current) =>
                              current.map((row) =>
                                row.clinicalOrderId === line.id ? { ...row, itemId: e.target.value } : row,
                              ),
                            )
                          }
                        >
                          <option value="">Select stock item…</option>
                          {items.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name} ({row.sku}) · {stockByItem.get(row.id)?.qty ?? 0} {row.unit} · FEFO{' '}
                              {stockByItem.get(row.id)?.batchNo ?? '—'}
                            </option>
                          ))}
                        </SelectField>
                        <Field
                          name={`qty-${line.id}`}
                          label={item ? `Quantity to dispense (${item.unit})` : 'Quantity to dispense'}
                          type="number"
                          min={0.01}
                          step="any"
                          required
                          value={draft.quantity}
                          onChange={(e) =>
                            setDrafts((current) =>
                              current.map((row) =>
                                row.clinicalOrderId === line.id ? { ...row, quantity: e.target.value } : row,
                              ),
                            )
                          }
                          hint={
                            stock
                              ? `${stock.qty} usable · batch ${stock.batchNo ?? '—'} · expiry ${stock.expiry ?? 'n/a'}`
                              : 'Select an item to see usable FEFO stock.'
                          }
                        />
                      </div>
                    )}
                    {!draft.rejected && item && Number.isFinite(qty) && remaining != null && qty > remaining ? (
                      <p className="mt-2 text-sm font-medium text-rose-700">
                        Cannot issue more than the remaining prescribed quantity ({remaining}).
                      </p>
                    ) : null}
                    {!draft.rejected && item && Number.isFinite(qty) && (stock?.qty ?? 0) < qty ? (
                      <p className="mt-2 text-sm font-medium text-rose-700">
                        Not enough usable stock. Need {qty}, have {stock?.qty ?? 0}.
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
              <p className="font-semibold">Dispense summary</p>
              <p className="mt-1">
                {totals.items} items · {totals.qty} units · estimated charge KES {totals.amount.toFixed(2)}
              </p>
              <p className="mt-1 text-teal-900">
                Stock movements are written per batch. Expired lots cannot be issued.
              </p>
            </div>

            {confirmOpen ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Confirm once. This deducts stock, writes the ledger, and keeps the prescription open if any quantity remains.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => setConfirmOpen(true)} disabled={!selectedLines.length}>
                Review confirmation
              </Button>
              <Button
                type="button"
                loading={dispense.isPending}
                disabled={!confirmOpen || dispense.isPending}
                onClick={() => dispense.mutate()}
              >
                Confirm dispensing
              </Button>
            </div>
          </div>
        </LabModal>
      ) : null}
    </div>
  )
}
