import { chargeRemaining, type ChargeStatus } from './charge.entities';
import { isRefundMetadata } from './payment-integrity';
import type { PaymentServiceLine } from './payment.entities';

export const DIAGNOSTIC_SERVICE_LINES = ['laboratory', 'radiology'] as const;
export type DiagnosticServiceLine = (typeof DIAGNOSTIC_SERVICE_LINES)[number];

export type DiagnosticChargeSnapshot = {
  id: string;
  serviceLine: PaymentServiceLine | string;
  serviceEntityId: string | null;
  status: ChargeStatus | string;
  amountOwed: string | number;
  amountPaid: string | number;
  amountWaived: string | number;
  metadata?: Record<string, unknown> | null;
};

export type DiagnosticPaymentSnapshot = {
  id?: string;
  chargeId?: string | null;
  serviceLine?: string | null;
  serviceEntityId?: string | null;
  status: string;
  method: string;
  amount?: string | number | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Request-row hints that must never grant clearance (Phase 5A).
 * They are accepted only so callers cannot accidentally treat them as evidence.
 */
export type DiagnosticRequestHints = {
  paymentStatus?: string | null;
  paymentReference?: string | null;
  paymentMethod?: string | null;
  claimStatus?: string | null;
  externalReference?: string | null;
};

export type DiagnosticClearanceDecision = {
  cleared: boolean;
  reason: string;
  remaining: number | null;
  chargeId: string | null;
};

const COLLECTED_METHODS = new Set(['cash', 'mpesa', 'card', 'quickbooks']);

function money(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function isDiagnosticLine(line: string): line is DiagnosticServiceLine {
  return line === 'laboratory' || line === 'radiology';
}

export function isAuditableWaiverAdjustment(row: unknown): row is {
  type: string;
  amount: number;
  reason: string;
  by: string;
} {
  if (!row || typeof row !== 'object') return false;
  const item = row as Record<string, unknown>;
  const type = String(item.type ?? '');
  if (type !== 'waiver' && type !== 'discount') return false;
  const amount = Number(item.amount);
  const reason = String(item.reason ?? '').trim();
  const by = String(item.by ?? '').trim();
  return Number.isFinite(amount) && amount > 0 && reason.length >= 3 && by.length > 0;
}

export function auditableWaiverAmount(charge: DiagnosticChargeSnapshot): number {
  const adjustments = charge.metadata?.adjustments;
  if (!Array.isArray(adjustments)) return 0;
  return adjustments.reduce((sum, row) => (isAuditableWaiverAdjustment(row) ? sum + Number(row.amount) : sum), 0);
}

function matchingTransactions(
  charge: DiagnosticChargeSnapshot,
  transactions: DiagnosticPaymentSnapshot[],
) {
  return transactions.filter(
    (row) =>
      (row.chargeId && row.chargeId === charge.id) ||
      (!row.chargeId &&
        row.serviceLine === charge.serviceLine &&
        row.serviceEntityId === charge.serviceEntityId),
  );
}

function netCollectedOnCharge(
  charge: DiagnosticChargeSnapshot,
  transactions: DiagnosticPaymentSnapshot[],
): number {
  let collected = 0;
  let refunds = 0;
  for (const row of matchingTransactions(charge, transactions)) {
    if (row.status !== 'completed') continue;
    const amount = money(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (isRefundMetadata(row.metadata) || row.metadata?.kind === 'refund') {
      refunds += amount;
      continue;
    }
    if (!COLLECTED_METHODS.has(row.method)) continue;
    collected += amount;
  }
  return Math.max(0, collected - refunds);
}

function deny(
  reason: string,
  remaining: number | null = null,
  chargeId: string | null = null,
): DiagnosticClearanceDecision {
  return { cleared: false, reason, remaining, chargeId };
}

function allow(
  reason: string,
  remaining: number,
  chargeId: string,
): DiagnosticClearanceDecision {
  return { cleared: true, reason, remaining, chargeId };
}

/**
 * Decision only. Does not read lab/radiology paymentStatus as money,
 * and does not write charges or payments.
 */
export function evaluateDiagnosticClearance(input: {
  serviceLine: DiagnosticServiceLine;
  serviceEntityId: string;
  charge: DiagnosticChargeSnapshot | null;
  transactions?: DiagnosticPaymentSnapshot[];
  request?: DiagnosticRequestHints;
}): DiagnosticClearanceDecision {
  const serviceEntityId = input.serviceEntityId?.trim() ?? '';
  if (!isDiagnosticLine(input.serviceLine) || !serviceEntityId) {
    return deny('invalid_request');
  }

  const charge = input.charge;
  if (!charge) {
    return deny('missing_charge');
  }
  if (charge.serviceLine !== input.serviceLine || charge.serviceEntityId !== serviceEntityId) {
    return deny('charge_does_not_match_request', null, charge.id);
  }
  if (charge.status === 'cancelled') {
    return deny('cancelled_charge', null, charge.id);
  }

  const owed = money(charge.amountOwed);
  const paid = money(charge.amountPaid);
  const waived = money(charge.amountWaived);
  if (!Number.isFinite(owed) || !Number.isFinite(paid) || !Number.isFinite(waived) || owed <= 0) {
    return deny('inconsistent_charge', null, charge.id);
  }
  if (paid < 0 || waived < 0) {
    return deny('inconsistent_charge', null, charge.id);
  }

  const remaining = chargeRemaining({
    amountOwed: String(owed),
    amountPaid: String(paid),
    amountWaived: String(waived),
  });

  if (remaining > 0) {
    return deny(charge.status === 'partially_paid' || paid > 0 ? 'partial_payment' : 'unpaid', remaining, charge.id);
  }

  if (charge.status !== 'paid' && charge.status !== 'waived') {
    return deny('inconsistent_charge', remaining, charge.id);
  }

  const transactions = input.transactions ?? [];
  const collected = netCollectedOnCharge(charge, transactions);
  const documentedWaiver = auditableWaiverAmount(charge);

  if (documentedWaiver + 1e-9 < waived) {
    return deny('unverified_waiver', remaining, charge.id);
  }

  if (collected + documentedWaiver + 1e-9 < owed) {
    return deny('not_collected_money', remaining, charge.id);
  }

  if (documentedWaiver + 1e-9 >= owed && collected <= 0) {
    return allow('waived', remaining, charge.id);
  }
  return allow('paid', remaining, charge.id);
}

/** Finds the unique live charge for a diagnostic request. Multiple live rows fail closed. */
export function selectDiagnosticCharge(
  charges: DiagnosticChargeSnapshot[],
  serviceLine: DiagnosticServiceLine,
  serviceEntityId: string,
): { charge: DiagnosticChargeSnapshot | null; reason?: string } {
  const matches = charges.filter(
    (row) => row.serviceLine === serviceLine && row.serviceEntityId === serviceEntityId,
  );
  const live = matches.filter((row) => row.status !== 'cancelled');
  if (live.length > 1) return { charge: null, reason: 'inconsistent_charge' };
  if (live.length === 1) return { charge: live[0] };
  if (matches.length) return { charge: matches[0] };
  return { charge: null, reason: 'missing_charge' };
}
