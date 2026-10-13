export type PaymentKind = 'payment' | 'refund';

export function paymentKind(metadata: Record<string, unknown> | null | undefined): PaymentKind {
  return metadata?.kind === 'refund' ? 'refund' : 'payment';
}

export function isRefundMetadata(metadata: Record<string, unknown> | null | undefined) {
  return paymentKind(metadata) === 'refund';
}

/** SQL fragment: completed collections, excluding refund rows. */
export function collectionsPredicate(alias: string) {
  return `${alias}.status = :completed AND COALESCE(${alias}.metadata->>'kind', 'payment') <> 'refund'`;
}

export function refundsPredicate(alias: string) {
  return `${alias}.status = :completed AND ${alias}.metadata->>'kind' = 'refund'`;
}

export function unmatchedPredicate(alias: string) {
  return `${alias}.status = :completed AND ${alias}.chargeId IS NULL AND COALESCE(${alias}.metadata->>'kind', 'payment') <> 'refund'`;
}

export function remainingBalance(owed: number, paid: number, waived: number) {
  return Math.max(0, owed - paid - waived);
}

export function allocatePayment(remaining: number, tender: number) {
  if (!Number.isFinite(remaining) || remaining < 0) {
    throw new Error('Remaining balance is invalid');
  }
  if (!Number.isFinite(tender) || tender <= 0) {
    throw new Error('Tender amount must be greater than zero');
  }
  if (tender > remaining) {
    throw new Error(`Payment exceeds remaining balance ${remaining}`);
  }
  const nextRemaining = remaining - tender;
  return {
    allocated: tender,
    remaining: nextRemaining,
    fullyPaid: nextRemaining <= 0,
  };
}

export function cashierTotals(
  rows: Array<{
    method: string;
    amount: string | number | null;
    status: string;
    metadata?: Record<string, unknown> | null;
  }>,
) {
  const collectionsByMethod: Record<string, number> = {};
  let collections = 0;
  let refunds = 0;
  let unmatched = 0;
  for (const row of rows) {
    if (row.status !== 'completed') continue;
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    if (isRefundMetadata(row.metadata)) {
      refunds += amount;
      continue;
    }
    collections += amount;
    collectionsByMethod[row.method] = (collectionsByMethod[row.method] ?? 0) + amount;
  }
  return { collections, refunds, unmatched, collectionsByMethod };
}

export function payerMixFromMethods(collectionsByMethod: Record<string, number>) {
  const insuranceRecorded = collectionsByMethod.insurance ?? 0;
  const waived = collectionsByMethod.waived ?? 0;
  const patientPayments = Object.entries(collectionsByMethod)
    .filter(([method]) => method !== 'insurance' && method !== 'waived')
    .reduce((sum, [, value]) => sum + value, 0);
  return {
    patientPayments,
    insuranceRecorded,
    waived,
    note: 'insuranceRecorded is cashier method=insurance, not SHA remittance received',
  };
}
