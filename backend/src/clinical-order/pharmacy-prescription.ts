export type PharmacyOrderLike = {
  id: string
  status: string
  metadata?: Record<string, unknown> | null
}

export function prescriptionGroupId(order: PharmacyOrderLike): string {
  const meta = order.metadata ?? {}
  const group = meta.prescriptionGroupId ?? meta.parentOrderId
  return typeof group === 'string' && group ? group : order.id
}

export function isPrescriptionHeader(order: PharmacyOrderLike): boolean {
  return order.metadata?.kind === 'prescription'
}

export function isPrescriptionLine(order: PharmacyOrderLike): boolean {
  return order.metadata?.kind === 'line' || !isPrescriptionHeader(order)
}

export function prescribedQuantity(order: PharmacyOrderLike): number {
  const raw = Number(order.metadata?.quantityPrescribed ?? order.metadata?.quantity ?? 0)
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export function dispensedQuantity(order: PharmacyOrderLike): number {
  const raw = Number(order.metadata?.quantityDispensed ?? order.metadata?.dispensedQuantity ?? 0)
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export function remainingQuantity(order: PharmacyOrderLike): number | null {
  const prescribed = prescribedQuantity(order)
  if (prescribed <= 0) return null
  return Math.max(0, prescribed - dispensedQuantity(order))
}

export function lineStatus(order: PharmacyOrderLike): string {
  if (order.status === 'cancelled') return 'cancelled'
  const remaining = remainingQuantity(order)
  if (remaining === 0) return 'dispensed'
  if (dispensedQuantity(order) > 0) return 'partially_dispensed'
  return order.status || 'requested'
}
