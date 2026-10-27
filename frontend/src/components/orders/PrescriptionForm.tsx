import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Field, SelectField, TextareaField } from '../ui'
import { apiRequest, formatApiError } from '../../lib/api'
import { drugClassLabel } from '../../lib/drug-class'
import { notify } from '../../lib/notify'
import { lineValidationError, suggestDispenseQuantity } from '../../lib/prescription-quantity'

export type CatalogItem = {
  id: string
  sku: string
  name: string
  unit: string
  strength?: string | null
  dosageForm?: string | null
  active?: boolean
  drugClass?: string | null
  genericName?: string | null
  brandName?: string | null
  formularyStatus?: 'hospital_formulary' | 'non_formulary'
  formularyStatusLabel?: string
  prescribingStatus?:
    | 'available_for_prescribing'
    | 'inactive_in_formulary'
    | 'non_pharmaceutical_item'
    | 'restricted_formulary_item'
  prescribingStatusLabel?: string
  regulatoryStatus?: 'ppb_registration_verified' | 'regulatory_status_unverified'
  regulatoryStatusLabel?: string
  ppbRegistrationNo?: string | null
  restricted?: boolean
  restrictionNote?: string | null
}

type Location = { id: string; code: string; locationType: string }
type BalanceBatch = { qtyOnHand: string; availableQuantity?: number; expiryDate?: string | null; item: { id: string } }

type DraftLine = {
  lineKey: string
  itemId: string
  medication: string
  strength: string
  dosageForm: string
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

export type PersistedPharmacyOrder = {
  id: string
  orderNo: string
  status: string
  priority?: string
  orderedAt: string
  completedAt?: string | null
  orderedBy?: {
    id: string
    firstName: string
    lastName: string
    employeeNo?: string
    specialisation?: string | null
  } | null
  encounter?: { id: string; encounterNo?: string; type?: string | null } | null
  admission?: {
    id: string
    admissionNo?: string
    ward?: { name?: string } | null
    bed?: { bedNo?: string } | null
  } | null
  metadata?: {
    kind?: string
    parentOrderId?: string
    prescriptionGroupId?: string
    lineNo?: number
    medication?: string
    medicationSummary?: string
    sku?: string | null
    strength?: string | null
    dosageForm?: string | null
    unit?: string | null
    dose?: string | null
    route?: string | null
    frequency?: string | null
    duration?: string | null
    unitsPerAdmin?: number | string | null
    itemId?: string | null
    quantity?: number | string | null
    quantityPrescribed?: number | string | null
    quantityDispensed?: number | string | null
    dispensedQuantity?: number | string | null
    instructions?: string | null
    saleStatus?: string | null
    billingStatus?: string | null
    cancelReason?: string | null
  } | null
}

export type GroupedPrescription = {
  groupId: string
  orderNo: string
  status: string
  priority: string
  orderedAt: string
  orderedByLabel: string | null
  contextLabel: string | null
  saleStatus: string | null
  billingStatus: string | null
  cancelReason: string | null
  canCancel: boolean
  lines: Array<{
    id: string
    orderNo: string
    itemId: string | null
    sku: string | null
    medication: string
    strength: string | null
    dosageForm: string | null
    unit: string | null
    dose: string | null
    route: string | null
    frequency: string | null
    duration: string | null
    prescribedQty: number
    dispensedQty: number
    remainingQty: number
    instructions: string | null
    status: string
  }>
}

export function groupPharmacyPrescriptions(orders: PersistedPharmacyOrder[]): GroupedPrescription[] {
  const groups = new Map<
    string,
    {
      header?: PersistedPharmacyOrder
      lines: PersistedPharmacyOrder[]
    }
  >()

  for (const order of orders) {
    const gid = String(order.metadata?.prescriptionGroupId ?? order.metadata?.parentOrderId ?? order.id)
    const entry = groups.get(gid) ?? { lines: [] }
    if (order.metadata?.kind === 'prescription') {
      entry.header = order
    } else {
      entry.lines.push(order)
    }
    groups.set(gid, entry)
  }

  const result: GroupedPrescription[] = []
  for (const [groupId, { header, lines }] of groups.entries()) {
    const sortedLines = [...lines].sort(
      (a, b) => Number(a.metadata?.lineNo ?? 0) - Number(b.metadata?.lineNo ?? 0),
    )
    const anchor = header ?? sortedLines[0]
    if (!anchor) continue
    // If only a bare header was returned with 0 lines (e.g. truncated page), do not render a fake "Medication" line
    if (!sortedLines.length && !header?.metadata?.medicationSummary) continue

    const mappedLines = sortedLines.map((line) => {
      const prescribed = Number(line.metadata?.quantityPrescribed ?? line.metadata?.quantity ?? 0)
      const dispensed = Number(line.metadata?.quantityDispensed ?? line.metadata?.dispensedQuantity ?? 0)
      const remaining = Math.max(0, prescribed - dispensed)
      return {
        id: line.id,
        orderNo: line.orderNo,
        itemId: line.metadata?.itemId ? String(line.metadata.itemId) : null,
        sku: line.metadata?.sku ? String(line.metadata.sku) : null,
        medication: String(line.metadata?.medication ?? line.orderNo),
        strength: line.metadata?.strength ? String(line.metadata.strength) : null,
        dosageForm: line.metadata?.dosageForm ? String(line.metadata.dosageForm) : null,
        unit: line.metadata?.unit ? String(line.metadata.unit) : null,
        dose: line.metadata?.dose ? String(line.metadata.dose) : null,
        route: line.metadata?.route ? String(line.metadata.route) : null,
        frequency: line.metadata?.frequency ? String(line.metadata.frequency) : null,
        duration: line.metadata?.duration ? String(line.metadata.duration) : null,
        prescribedQty: Number.isFinite(prescribed) ? prescribed : 0,
        dispensedQty: Number.isFinite(dispensed) ? dispensed : 0,
        remainingQty: Number.isFinite(remaining) ? remaining : 0,
        instructions: line.metadata?.instructions ? String(line.metadata.instructions) : null,
        status: line.status,
      }
    })

    const allDispensed = mappedLines.length > 0 && mappedLines.every((l) => l.status === 'dispensed' || l.remainingQty === 0)
    const anyDispensed = mappedLines.some((l) => l.dispensedQty > 0 || l.status === 'partially_dispensed')
    const allCancelled =
      anchor.status === 'cancelled' || (mappedLines.length > 0 && mappedLines.every((l) => l.status === 'cancelled'))

    const status = allCancelled
      ? 'cancelled'
      : allDispensed
        ? 'dispensed'
        : anyDispensed
          ? 'partially_dispensed'
          : header?.status || anchor.status || 'requested'

    const prescriber = anchor.orderedBy
      ? `Dr. ${anchor.orderedBy.firstName} ${anchor.orderedBy.lastName}`.trim()
      : null

    const contextLabel = anchor.admission?.id
      ? [
          'IPD',
          anchor.admission.admissionNo,
          anchor.admission.ward?.name,
          anchor.admission.bed?.bedNo ? `Bed ${anchor.admission.bed.bedNo}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : anchor.encounter?.id
        ? ['OPD', anchor.encounter.encounterNo].filter(Boolean).join(' · ')
        : null

    const saleStatus =
      sortedLines.map((l) => l.metadata?.saleStatus).find(Boolean) ??
      header?.metadata?.saleStatus ??
      null
    const billingStatus =
      sortedLines.map((l) => l.metadata?.billingStatus).find(Boolean) ??
      header?.metadata?.billingStatus ??
      null

    result.push({
      groupId,
      orderNo: header?.orderNo ?? anchor.orderNo,
      status,
      priority: anchor.priority ?? 'routine',
      orderedAt: anchor.orderedAt,
      orderedByLabel: prescriber,
      contextLabel,
      saleStatus: saleStatus ? String(saleStatus) : null,
      billingStatus: billingStatus ? String(billingStatus) : null,
      cancelReason: anchor.metadata?.cancelReason ? String(anchor.metadata.cancelReason) : null,
      canCancel: status === 'requested' && !anyDispensed,
      lines: mappedLines,
    })
  }

  return result.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
}

function newLineKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const emptyLine = (): DraftLine => ({
  lineKey: newLineKey(),
  itemId: '',
  medication: '',
  strength: '',
  dosageForm: '',
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
  const [lines, setLines] = useState<DraftLine[]>(() => [emptyLine()])
  const [lastSaved, setLastSaved] = useState<{
    orderNo: string
    orderedAt: string
    replayed?: boolean
    lines: Array<{
      id: string
      orderNo: string
      medication: string
      dose: string
      route: string
      frequency: string
      duration: string
      quantity: number
      instructions: string
    }>
  } | null>(null)

  const {
    data: items = [],
    isLoading: catalogLoading,
    error: catalogError,
  } = useQuery({
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
      const qty = Number(batch.availableQuantity ?? batch.qtyOnHand)
      if (!Number.isFinite(qty) || qty <= 0) continue
      if (batch.expiryDate && batch.expiryDate < today) continue
      map.set(batch.item.id, (map.get(batch.item.id) ?? 0) + qty)
    }
    return map
  }, [balances])

  const updateLine = (lineKey: string, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line) => {
        if (line.lineKey !== lineKey) return line
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
        strength: line.strength.trim() || undefined,
        dosageForm: line.dosageForm.trim() || undefined,
        unit: line.unit.trim() || undefined,
        dose: line.dose.trim() || undefined,
        route: line.route.trim() || undefined,
        frequency: line.frequency.trim() || undefined,
        duration: line.duration.trim() || undefined,
        unitsPerAdmin: Number(line.unitsPerAdmin) || undefined,
        quantity: Number(line.quantity),
        itemId: line.itemId,
        instructions: line.instructions.trim() || undefined,
      }))
      return apiRequest<{
        header: PersistedPharmacyOrder
        lines: PersistedPharmacyOrder[]
        replayed?: boolean
      }>('/clinical-orders/pharmacy/prescription', {
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
    onSuccess: async (persisted) => {
      setLastSaved({
        orderNo: persisted.header?.orderNo ?? 'RX',
        orderedAt: persisted.header?.orderedAt ?? new Date().toISOString(),
        replayed: persisted.replayed,
        lines: (persisted.lines ?? []).map((row) => ({
          id: row.id,
          orderNo: row.orderNo,
          medication: String(row.metadata?.medication ?? row.orderNo),
          dose: String(row.metadata?.dose ?? ''),
          route: String(row.metadata?.route ?? ''),
          frequency: String(row.metadata?.frequency ?? ''),
          duration: String(row.metadata?.duration ?? ''),
          quantity: Number(row.metadata?.quantityPrescribed ?? row.metadata?.quantity ?? 0),
          instructions: String(row.metadata?.instructions ?? ''),
        })),
      })
      notify(
        persisted.replayed ? 'Prescription already recorded' : 'Prescription sent to Pharmacy',
        `${persisted.lines?.length ?? lines.length} medication ${
          (persisted.lines?.length ?? lines.length) === 1 ? 'line is' : 'lines are'
        } on the pharmacy queue (${persisted.header?.orderNo ?? 'saved'}). Stock is not deducted until Pharmacy issues after clearance.`,
        'success',
      )
      setLines([emptyLine()])
      setPriority('routine')
      setReviewing(false)
      setClientRequestId(newClientRequestId())
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clinical-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['consultation-pharmacy'] }),
        queryClient.invalidateQueries({ queryKey: ['ipd-pharmacy'] }),
        queryClient.invalidateQueries({ queryKey: ['patient-timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['consultation-timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['patient-chart'] }),
        queryClient.invalidateQueries({ queryKey: ['pharmacy-dashboard'] }),
      ])
      onSuccess?.()
    },
    onError: (error: Error) =>
      notify('Prescription failed', formatApiError(error, error.message), 'critical'),
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
      {catalogError ? (
        <Alert tone="error">
          {formatApiError(catalogError, 'Could not load the hospital formulary catalogue.')}
        </Alert>
      ) : null}

      {lastSaved ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              Persisted prescription {lastSaved.orderNo} ·{' '}
              {new Date(lastSaved.orderedAt).toLocaleString()}
              {lastSaved.replayed ? ' (idempotent replay)' : ''}
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-emerald-800 underline"
              onClick={() => setLastSaved(null)}
            >
              Dismiss
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-emerald-900">
            {lastSaved.lines.map((line, i) => (
              <li key={line.id}>
                {i + 1}. <strong>{line.medication}</strong> · {line.dose} · {line.route} · {line.frequency}
                {line.duration ? ` · ${line.duration}` : ''} · Qty {line.quantity}
                {line.instructions ? ` — ${line.instructions}` : ''} ({line.orderNo})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
          if (row.id === line.itemId) return true
          const q = line.search.trim().toLowerCase()
          if (!q) return true
          return (
            row.name.toLowerCase().includes(q) ||
            row.sku.toLowerCase().includes(q) ||
            (row.strength ?? '').toLowerCase().includes(q) ||
            drugClassLabel(row.drugClass).toLowerCase().includes(q)
          )
        })
        return (
          <div key={line.lineKey} className="space-y-3 rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">Medication line {index + 1}</p>
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setLines((current) => current.filter((row) => row.lineKey !== line.lineKey))}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <Field
              name={`catalogSearch-${index}`}
              label="Search hospital formulary (optional)"
              placeholder="Type medicine name, generic/brand name, strength, SKU, or class…"
              value={line.search}
              onChange={(e) => updateLine(line.lineKey, { search: e.target.value })}
            />
            <SelectField
              name={`itemId-${index}`}
              label="Hospital formulary medicine"
              required
              disabled={catalogLoading}
              hint={
                item
                  ? [
                      item.sku,
                      item.formularyStatusLabel ?? 'Hospital formulary',
                      item.prescribingStatusLabel ??
                        (item.active === false ? 'Inactive in hospital formulary' : 'Available for prescribing'),
                      item.regulatoryStatus === 'ppb_registration_verified' && item.ppbRegistrationNo
                        ? `PPB registration verified (${item.ppbRegistrationNo})`
                        : 'PPB regulatory registration not recorded',
                      item.strength,
                      item.dosageForm || item.unit,
                      drugClassLabel(item.drugClass),
                      stock == null
                        ? 'stock unknown'
                        : stock <= 0
                          ? 'out of stock in PHARMACY — still prescribable'
                          : `${stock} available in PHARMACY`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Select a medicine from the canonical hospital formulary catalogue (demo.inventory_items). Inclusion in the hospital formulary means the item is enabled for prescribing in AfyaSasa; it does not establish PPB regulatory authorization unless verified registration evidence is recorded.'
              }
              value={line.itemId}
              onChange={(e) => {
                const selected = items.find((row) => row.id === e.target.value)
                if (selected && selected.active === false) return
                updateLine(line.lineKey, {
                  itemId: e.target.value,
                  medication: selected?.name ?? '',
                  strength: selected?.strength ?? '',
                  dosageForm: selected?.dosageForm ?? selected?.unit ?? '',
                  unit: selected?.unit ?? selected?.dosageForm ?? '',
                  dose: line.dose || selected?.strength || '',
                })
              }}
            >
              <option value="">
                {catalogLoading ? 'Loading hospital formulary catalogue…' : 'Select hospital formulary medicine…'}
              </option>
              {matches.slice(0, 80).map((row) => {
                const qty = stockByItem.get(row.id)
                const stockLabel =
                  qty == null ? '' : qty <= 0 ? ' · out of stock' : qty < 10 ? ` · low (${qty})` : ` · ${qty} available`
                const identity = [row.strength, row.dosageForm || row.unit].filter(Boolean).join(' ')
                const statusSuffix =
                  row.active === false
                    ? ' · INACTIVE IN FORMULARY'
                    : row.restricted
                      ? ` · RESTRICTED${row.restrictionNote ? ` (${row.restrictionNote})` : ''}${stockLabel}`
                      : stockLabel
                return (
                  <option key={row.id} value={row.id} disabled={row.active === false}>
                    {row.name} {identity ? `· ${identity}` : ''} ({row.sku})
                    {statusSuffix}
                  </option>
                )
              })}
            </SelectField>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Field
                name={`dose-${index}`}
                label="Dose / strength"
                placeholder="500 mg"
                required
                value={line.dose}
                onChange={(e) => updateLine(line.lineKey, { dose: e.target.value })}
              />
              <SelectField
                name={`route-${index}`}
                label="Route / form"
                required
                value={line.route}
                onChange={(e) => updateLine(line.lineKey, { route: e.target.value })}
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
                placeholder="TDS / BD / OD"
                required
                value={line.frequency}
                onChange={(e) => updateLine(line.lineKey, { frequency: e.target.value })}
              />
              <Field
                name={`duration-${index}`}
                label="Duration"
                placeholder="5 days"
                value={line.duration}
                onChange={(e) => updateLine(line.lineKey, { duration: e.target.value })}
              />
              <Field
                name={`unitsPerAdmin-${index}`}
                label="Units each dose"
                type="number"
                min={0.01}
                step="any"
                placeholder="1"
                value={line.unitsPerAdmin}
                onChange={(e) => updateLine(line.lineKey, { unitsPerAdmin: e.target.value })}
              />
              <Field
                name={`quantity-${index}`}
                label="Quantity to issue"
                type="number"
                min={0.01}
                step="any"
                required
                value={line.quantity}
                onChange={(e) => updateLine(line.lineKey, { quantity: e.target.value, quantityTouched: true })}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {item?.strength
                  ? `Product identity: ${item.strength}${item.dosageForm ? ` · ${item.dosageForm}` : ''}. `
                  : ''}
                {suggestion.calculable
                  ? `Suggested quantity: ${suggestion.quantity} (${suggestion.reason}).`
                  : suggestion.reason}
              </span>
              {suggestion.calculable && suggestion.quantity != null && String(suggestion.quantity) !== line.quantity ? (
                <button
                  type="button"
                  className="font-semibold text-teal-700 underline"
                  onClick={() =>
                    updateLine(line.lineKey, {
                      quantity: String(suggestion.quantity),
                      quantityTouched: true,
                    })
                  }
                >
                  Apply suggested ({suggestion.quantity})
                </button>
              ) : null}
            </div>
            {lineErrors[index] ? <p className="text-xs font-medium text-rose-700">{lineErrors[index]}</p> : null}
            <TextareaField
              name={`instructions-${index}`}
              label="Administration instructions"
              rows={2}
              value={line.instructions}
              onChange={(e) => updateLine(line.lineKey, { instructions: e.target.value })}
              placeholder="Take after food, complete full course…"
            />
          </div>
        )
      })}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-900">
          {reviewing ? 'Confirm prescription before sending to Pharmacy' : 'Live prescription preview'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Priority: <strong className="uppercase">{priority}</strong> · Prescribing does not deduct inventory stock.
        </p>
        <ul className="mt-2 space-y-1.5 text-xs text-slate-800">
          {lines.map((line, index) => {
            const item = items.find((row) => row.id === line.itemId)
            return (
              <li key={line.lineKey} className="rounded-lg bg-white px-3 py-2 border border-slate-200/80">
                <span className="font-semibold">
                  {index + 1}. {line.medication || item?.name || 'Select catalogue product'}
                </span>
                {line.strength || item?.strength ? ` (${line.strength || item?.strength})` : ''}
                {line.dosageForm || item?.dosageForm ? ` · ${line.dosageForm || item?.dosageForm}` : ''}
                {' — '}
                <span>Dose: {line.dose || '—'}</span> · <span>Route: {line.route || '—'}</span> ·{' '}
                <span>Freq: {line.frequency || '—'}</span>
                {line.duration ? ` · Duration: ${line.duration}` : ''} ·{' '}
                <span className="font-semibold text-teal-900">
                  Qty: {line.quantity || '—'} {line.unit || item?.unit || ''}
                </span>
                {line.instructions ? <div className="mt-0.5 text-slate-600">Instructions: {line.instructions}</div> : null}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={lines.length >= 30}
          onClick={() => {
            setReviewing(false)
            setLines((current) => [...current, emptyLine()])
          }}
        >
          Add medication line
        </Button>
        {reviewing ? (
          <Button type="button" variant="secondary" onClick={() => setReviewing(false)}>
            Edit lines
          </Button>
        ) : null}
        <Button type="submit" loading={order.isPending} disabled={order.isPending}>
          {reviewing ? `Confirm & send ${lines.length} line${lines.length === 1 ? '' : 's'}` : 'Review prescription'}
        </Button>
      </div>
    </form>
  )
}

export function PrescriptionOrdersList({
  orders,
  isLoading,
  error,
  emptyMessage = 'No prescriptions recorded for this patient yet.',
  allowCancel = false,
}: {
  orders: PersistedPharmacyOrder[]
  isLoading?: boolean
  error?: unknown
  emptyMessage?: string
  allowCancel?: boolean
}) {
  const queryClient = useQueryClient()
  const grouped = useMemo(() => groupPharmacyPrescriptions(orders), [orders])

  const cancelMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiRequest(`/clinical-orders/pharmacy/${groupId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by clinician before dispensing' }),
      }),
    onSuccess: async () => {
      notify('Prescription cancelled', 'Un-dispensed prescription marked cancelled with audit trail.', 'success')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clinical-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['consultation-pharmacy'] }),
        queryClient.invalidateQueries({ queryKey: ['ipd-pharmacy'] }),
        queryClient.invalidateQueries({ queryKey: ['patient-timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['patient-chart'] }),
      ])
    },
    onError: (err: Error) => notify('Could not cancel prescription', formatApiError(err, err.message), 'critical'),
  })

  if (error) {
    return (
      <Alert tone="error">
        {formatApiError(error, 'Could not load prescriptions.')}
      </Alert>
    )
  }

  if (isLoading) {
    return <div className="h-32 animate-skeleton rounded-2xl" />
  }

  if (!grouped.length) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {grouped.map((group) => (
        <div key={group.groupId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{group.orderNo}</p>
                {group.contextLabel ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {group.contextLabel}
                  </span>
                ) : null}
                <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold uppercase text-teal-800">
                  {group.priority}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Prescribed {new Date(group.orderedAt).toLocaleString()}
                {group.orderedByLabel ? ` · ${group.orderedByLabel}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                  group.status === 'dispensed'
                    ? 'bg-emerald-100 text-emerald-900'
                    : group.status === 'partially_dispensed'
                      ? 'bg-amber-100 text-amber-900'
                      : group.status === 'cancelled'
                        ? 'bg-rose-100 text-rose-900'
                        : 'bg-slate-100 text-slate-800'
                }`}
              >
                {group.status.replace(/_/g, ' ')}
              </span>
              {group.saleStatus ? (
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900">
                  Hold: {group.saleStatus.replace(/_/g, ' ')}
                </span>
              ) : null}
              {group.billingStatus ? (
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-900">
                  Billing: {group.billingStatus.replace(/_/g, ' ')}
                </span>
              ) : null}
              {allowCancel && group.canCancel ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  loading={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(group.groupId)}
                >
                  Cancel Rx
                </Button>
              ) : null}
            </div>
          </div>

          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {group.lines.map((line, idx) => (
              <li key={line.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {idx + 1}. {line.medication}
                    {line.strength ? ` (${line.strength})` : ''}
                    {line.dosageForm ? ` · ${line.dosageForm}` : ''}
                    {line.sku ? <span className="ml-1.5 font-mono text-xs text-slate-400">[{line.sku}]</span> : null}
                  </p>
                  <p className="text-xs text-slate-600">
                    {[
                      line.dose ? `Dose: ${line.dose}` : null,
                      line.route ? `Route: ${line.route}` : null,
                      line.frequency ? `Freq: ${line.frequency}` : null,
                      line.duration ? `Duration: ${line.duration}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {line.instructions ? (
                    <p className="mt-0.5 text-xs italic text-slate-600">Instructions: {line.instructions}</p>
                  ) : null}
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold tabular-nums text-slate-800">
                    Prescribed: {line.prescribedQty} {line.unit ?? ''}
                  </p>
                  <p className="tabular-nums text-slate-600">
                    Issued: {line.dispensedQty} · Remaining: {line.remainingQty}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {group.cancelReason ? (
            <p className="mt-2 text-xs text-rose-700">Cancelled: {group.cancelReason}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
