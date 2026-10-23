import { chargeRemaining, type ChargeStatus } from './charge.entities';
import { isAuditableWaiverAdjustment, auditableWaiverAmount } from './diagnostic-clearance';
import { isRefundMetadata } from './payment-integrity';
import type { PaymentServiceLine } from './payment.entities';

export const PHARMACY_SERVICE_LINE = 'pharmacy' as const;

/** Only collected till/M-Pesa/card money. Insurance labels and waivers are not cash. */
const COLLECTED_METHODS = new Set(['cash', 'mpesa', 'card', 'quickbooks']);

export type PharmacyChargeSnapshot = {
  id: string;
  serviceLine: PaymentServiceLine | string;
  serviceEntityId: string | null;
  status: ChargeStatus | string;
  amountOwed: string | number;
  amountPaid: string | number;
  amountWaived: string | number;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export type PharmacyPaymentSnapshot = {
  chargeId?: string | null;
  serviceLine?: string | null;
  serviceEntityId?: string | null;
  status: string;
  method: string;
  amount?: string | number | null;
  metadata?: Record<string, unknown> | null;
};

export type PharmacyCreditApproval = {
  by: string;
  at: string;
  reason: string;
  amount: number;
};

export type PharmacyClearanceDecision = {
  cleared: boolean;
  reason: string;
  remaining: number | null;
  chargeId: string | null;
  message: string;
};

function money(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function deny(reason: string, message: string, remaining: number | null = null, chargeId: string | null = null): PharmacyClearanceDecision {
  return { cleared: false, reason, message, remaining, chargeId };
}

function allow(reason: string, message: string, remaining: number, chargeId: string): PharmacyClearanceDecision {
  return { cleared: true, reason, message, remaining, chargeId };
}

export function readCreditApproval(metadata: Record<string, unknown> | null | undefined): PharmacyCreditApproval | null {
  const raw = metadata?.creditApproval;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const by = String(row.by ?? '').trim();
  const at = String(row.at ?? '').trim();
  const reason = String(row.reason ?? '').trim();
  const amount = Number(row.amount);
  if (!by || !at || reason.length < 3 || !Number.isFinite(amount) || amount <= 0) return null;
  return { by, at, reason, amount };
}

function matchingTransactions(charge: PharmacyChargeSnapshot, transactions: PharmacyPaymentSnapshot[]) {
  return transactions.filter(
    (row) =>
      (row.chargeId && row.chargeId === charge.id) ||
      (!row.chargeId &&
        row.serviceLine === charge.serviceLine &&
        row.serviceEntityId === charge.serviceEntityId),
  );
}

function netCollectedOnCharge(charge: PharmacyChargeSnapshot, transactions: PharmacyPaymentSnapshot[]): number {
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

/**
 * Authoritative pharmacy release gate.
 *
 * Fail-closed rules (unconfirmed Jalaram insurance/waiver policy):
 * - Insurance claim remittance and cashier method=insurance do not clear release.
 * - A waived payment method without auditable charge.metadata.adjustments does not clear.
 * - Partial payment does not clear unless a documented credit approval covers the remainder.
 * - Missing, cancelled, or charges-disabled bills do not clear.
 * - This function never reads clinical_orders.metadata or frontend labels as money.
 */
export function evaluatePharmacyClearance(input: {
  serviceEntityId: string;
  chargesEnabled: boolean;
  charge: PharmacyChargeSnapshot | null;
  transactions?: PharmacyPaymentSnapshot[];
}): PharmacyClearanceDecision {
  const serviceEntityId = input.serviceEntityId?.trim() ?? '';
  if (!serviceEntityId) {
    return deny('invalid_request', 'The sale identifier is missing.');
  }
  if (!input.chargesEnabled) {
    return deny('charges_disabled', 'Operational charges are disabled. Medicine cannot be issued until billing is available.');
  }
  const charge = input.charge;
  if (!charge) {
    return deny('missing_charge', 'This sale has no pharmacy bill. Prepare the sale again so a charge is created.');
  }
  if (charge.serviceLine !== PHARMACY_SERVICE_LINE || charge.serviceEntityId !== serviceEntityId) {
    return deny('charge_does_not_match_sale', 'The bill does not belong to this pharmacy sale.', null, charge.id);
  }
  if (charge.status === 'cancelled') {
    return deny('cancelled_charge', 'This sale was cancelled and cannot be issued.', null, charge.id);
  }

  const owed = money(charge.amountOwed);
  const paid = money(charge.amountPaid);
  const waived = money(charge.amountWaived);
  if (!Number.isFinite(owed) || !Number.isFinite(paid) || !Number.isFinite(waived) || owed <= 0) {
    return deny('inconsistent_charge', 'The pharmacy bill is incomplete or unpriced. Issue is blocked.', null, charge.id);
  }
  if (paid < 0 || waived < 0) {
    return deny('inconsistent_charge', 'The pharmacy bill amounts are inconsistent. Issue is blocked.', null, charge.id);
  }

  const remaining = chargeRemaining({
    amountOwed: String(owed),
    amountPaid: String(paid),
    amountWaived: String(waived),
  });
  const transactions = input.transactions ?? [];
  const collected = netCollectedOnCharge(charge, transactions);
  const documentedWaiver = auditableWaiverAmount(charge as never);
  const credit = readCreditApproval(charge.metadata ?? null);

  if (remaining > 0) {
    if (credit && credit.amount + 1e-9 >= remaining) {
      return allow(
        'credit',
        'Documented credit approval covers the outstanding balance.',
        remaining,
        charge.id,
      );
    }
    const message =
      charge.status === 'partially_paid' || paid > 0
        ? 'This sale cannot be issued because the bill is only partly paid.'
        : 'This sale cannot be issued because its bill is still outstanding.';
    return deny(paid > 0 ? 'partial_payment' : 'unpaid', message, remaining, charge.id);
  }

  if (charge.status !== 'paid' && charge.status !== 'waived') {
    return deny('inconsistent_charge', 'The bill status does not match a zero remaining balance.', remaining, charge.id);
  }

  if (documentedWaiver + 1e-9 < waived) {
    return deny(
      'unverified_waiver',
      'The exemption on this bill is not documented with an authorised adjustment. Issue is blocked.',
      remaining,
      charge.id,
    );
  }

  if (collected + documentedWaiver + 1e-9 < owed) {
    return deny(
      'not_collected_money',
      'No verified collection or documented exemption covers this bill. Insurance labels are not treated as payment.',
      remaining,
      charge.id,
    );
  }

  if (documentedWaiver + 1e-9 >= owed && collected <= 0) {
    return allow('waived', 'Documented exemption covers this pharmacy bill.', remaining, charge.id);
  }
  return allow('paid', 'Verified payment covers this pharmacy bill.', remaining, charge.id);
}

export { isAuditableWaiverAdjustment, auditableWaiverAmount };
