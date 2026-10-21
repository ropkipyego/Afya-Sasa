import { canViewDirectorFinance } from '../common/errors/director-access';

export function canViewRevenueSummary(user?: { roles?: string[]; permissions?: string[] }) {
  return canViewDirectorFinance(user) || (user?.permissions ?? []).includes('payments:initiate');
}

export type ChargeSnapshot = {
  amountOwed: number;
  amountPaid: number;
  amountWaived: number;
  status: string;
  serviceLine: string;
};

export type PaymentSnapshot = {
  amount: number;
  status: string;
  method: string;
  kind?: string;
  serviceLine?: string | null;
};

/** Charges raised: owed amount on non-cancelled charges. Partially paid still counts the full raised amount once. */
export function summariseCharges(rows: ChargeSnapshot[]) {
  const byServiceLine: Record<string, number> = {};
  let charges = 0;
  let waived = 0;
  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    charges += row.amountOwed;
    waived += row.amountWaived;
    byServiceLine[row.serviceLine] = (byServiceLine[row.serviceLine] ?? 0) + row.amountOwed;
  }
  return { charges, waived, byServiceLine };
}

/** Collected: completed payments that are not refunds. Waived method is not cash collected. */
export function summariseCollections(rows: PaymentSnapshot[]) {
  let collections = 0;
  let refunds = 0;
  let waivedPayments = 0;
  const byServiceLine: Record<string, number> = {};
  for (const row of rows) {
    if (row.status !== 'completed') continue;
    if (row.kind === 'refund') {
      refunds += row.amount;
      continue;
    }
    if (row.method === 'waived') {
      waivedPayments += row.amount;
      continue;
    }
    collections += row.amount;
    const line = row.serviceLine || 'other';
    byServiceLine[line] = (byServiceLine[line] ?? 0) + row.amount;
  }
  return { collections, refunds, waivedPayments, byServiceLine };
}

export const REVENUE_SUMMARY_DEFINITIONS = {
  charges:
    'Sum of amount_owed on charges created in the period, excluding cancelled. Partial payment does not reduce charges raised.',
  collections:
    'Sum of completed payment_transactions in the period, excluding refunds and method=waived. Not QuickBooks and not profit.',
  refunds: 'Completed payment_transactions whose metadata.kind is refund in the period.',
  waivers: 'Sum of amount_waived on non-cancelled charges created in the period.',
  outstanding: 'Current remaining balance on owed and partially_paid charges. Not limited to the selected period.',
} as const;
