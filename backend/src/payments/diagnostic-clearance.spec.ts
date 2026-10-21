import { chargeRemaining } from './charge.entities';
import {
  auditableWaiverAmount,
  evaluateDiagnosticClearance,
  selectDiagnosticCharge,
  type DiagnosticChargeSnapshot,
  type DiagnosticPaymentSnapshot,
} from './diagnostic-clearance';

const REQUEST = 'lab-req-1';
const OTHER = 'lab-req-2';

function charge(overrides: Partial<DiagnosticChargeSnapshot> = {}): DiagnosticChargeSnapshot {
  return {
    id: 'chg-1',
    serviceLine: 'laboratory',
    serviceEntityId: REQUEST,
    status: 'owed',
    amountOwed: '1000',
    amountPaid: '0',
    amountWaived: '0',
    metadata: { kind: 'lab_request', source: 'LABORATORY' },
    ...overrides,
  };
}

function txn(overrides: Partial<DiagnosticPaymentSnapshot> = {}): DiagnosticPaymentSnapshot {
  return {
    id: 'pay-1',
    chargeId: 'chg-1',
    serviceLine: 'laboratory',
    serviceEntityId: REQUEST,
    status: 'completed',
    method: 'cash',
    amount: '1000',
    metadata: { kind: 'payment' },
    ...overrides,
  };
}

describe('evaluateDiagnosticClearance', () => {
  it('clears a fully paid matching charge using posted collected money', () => {
    const row = charge({ status: 'paid', amountPaid: '1000' });
    expect(chargeRemaining(row)).toBe(0);
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: row,
        transactions: [txn()],
      }),
    ).toEqual({
      cleared: true,
      reason: 'paid',
      remaining: 0,
      chargeId: 'chg-1',
    });
  });

  it('denies an unpaid matching charge', () => {
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: charge(),
        transactions: [],
      }),
    ).toMatchObject({ cleared: false, reason: 'unpaid', remaining: 1000 });
  });

  it('denies a partial payment even when a receipt number is on the request', () => {
    const row = charge({ status: 'partially_paid', amountPaid: '400' });
    expect(chargeRemaining(row)).toBe(600);
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: row,
        transactions: [txn({ amount: '400' })],
        request: { paymentStatus: 'paid', paymentReference: 'RCPT-1' },
      }),
    ).toMatchObject({ cleared: false, reason: 'partial_payment', remaining: 600 });
  });

  it('denies after a refund restores an outstanding balance', () => {
    const row = charge({ status: 'partially_paid', amountPaid: '200' });
    expect(chargeRemaining(row)).toBe(800);
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: row,
        transactions: [
          txn({ id: 'pay-full', amount: '1000' }),
          txn({
            id: 'rf-1',
            amount: '800',
            metadata: { kind: 'refund', originalPaymentId: 'pay-full' },
          }),
        ],
      }),
    ).toMatchObject({ cleared: false, reason: 'partial_payment', remaining: 800 });
  });

  it('does not let a payment against a different request clear this request', () => {
    const otherCharge = charge({
      id: 'chg-other',
      serviceEntityId: OTHER,
      status: 'paid',
      amountPaid: '1000',
    });
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: otherCharge,
        transactions: [txn({ chargeId: 'chg-other', serviceEntityId: OTHER })],
      }),
    ).toMatchObject({ cleared: false, reason: 'charge_does_not_match_request' });

    const selected = selectDiagnosticCharge([otherCharge], 'laboratory', REQUEST);
    expect(selected.charge).toBeNull();
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: selected.charge,
        transactions: [txn({ chargeId: 'chg-other', serviceEntityId: OTHER })],
      }),
    ).toMatchObject({ cleared: false, reason: 'missing_charge' });
  });

  it('does not treat insurance, claim status or a portal reference as collected money', () => {
    const row = charge({ status: 'paid', amountPaid: '1000' });
    expect(chargeRemaining(row)).toBe(0);
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'radiology',
        serviceEntityId: REQUEST,
        charge: { ...row, serviceLine: 'radiology' },
        transactions: [
          txn({
            method: 'insurance',
            serviceLine: 'radiology',
            metadata: { kind: 'payment' },
          }),
        ],
        request: {
          paymentStatus: 'insurance_pending',
          paymentMethod: 'insurance',
          claimStatus: 'settled',
          externalReference: 'SHA-99',
        },
      }),
    ).toMatchObject({ cleared: false, reason: 'not_collected_money', remaining: 0 });
  });

  it('clears only when a documented charge adjustment records actor, reason and amount', () => {
    const undocumented = charge({ status: 'waived', amountWaived: '1000' });
    expect(chargeRemaining(undocumented)).toBe(0);
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: undocumented,
        transactions: [txn({ method: 'waived', metadata: { kind: 'payment' } })],
      }),
    ).toMatchObject({ cleared: false, reason: 'unverified_waiver' });

    const documented = charge({
      status: 'waived',
      amountWaived: '1000',
      metadata: {
        adjustments: [
          {
            type: 'waiver',
            amount: 1000,
            reason: 'Director authorised staff exemption',
            by: 'finance-1',
            at: '2026-10-20T20:00:00.000Z',
          },
        ],
      },
    });
    expect(auditableWaiverAmount(documented)).toBe(1000);
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: documented,
        transactions: [
          txn({
            method: 'waived',
            metadata: { kind: 'waiver', reason: 'Director authorised staff exemption' },
          }),
        ],
      }),
    ).toMatchObject({ cleared: true, reason: 'waived', remaining: 0 });
  });

  it('denies a missing, cancelled or inconsistent charge', () => {
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: null,
      }),
    ).toMatchObject({ cleared: false, reason: 'missing_charge' });

    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: charge({ status: 'cancelled' }),
      }),
    ).toMatchObject({ cleared: false, reason: 'cancelled_charge' });

    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: charge({ amountOwed: 'not-a-number' }),
      }),
    ).toMatchObject({ cleared: false, reason: 'inconsistent_charge' });

    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: charge({ status: 'owed', amountPaid: '1000', amountOwed: '1000' }),
        transactions: [txn()],
      }),
    ).toMatchObject({ cleared: false, reason: 'inconsistent_charge' });
  });

  it('denies a typed receipt reference when no completed collected payment is posted', () => {
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: charge(),
        transactions: [
          txn({ status: 'initiated', method: 'mpesa', amount: '1000' }),
        ],
        request: { paymentStatus: 'paid', paymentReference: 'typed-at-reception' },
      }),
    ).toMatchObject({ cleared: false, reason: 'unpaid' });

    const falselyPaid = charge({ status: 'paid', amountPaid: '1000' });
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: falselyPaid,
        transactions: [],
        request: { paymentReference: 'RCPT-GHOST' },
      }),
    ).toMatchObject({ cleared: false, reason: 'not_collected_money' });
  });

  it('does not create or alter financial records when evaluated repeatedly', () => {
    const row = charge({ status: 'paid', amountPaid: '1000' });
    const payments = [txn()];
    const freeze = JSON.stringify({ row, payments });
    const first = evaluateDiagnosticClearance({
      serviceLine: 'laboratory',
      serviceEntityId: REQUEST,
      charge: row,
      transactions: payments,
    });
    const second = evaluateDiagnosticClearance({
      serviceLine: 'laboratory',
      serviceEntityId: REQUEST,
      charge: row,
      transactions: payments,
    });
    expect(second).toEqual(first);
    expect(JSON.stringify({ row, payments })).toBe(freeze);
  });

  it('clears mix of collected money and a documented waiver that together settle the charge', () => {
    const row = charge({
      status: 'paid',
      amountPaid: '600',
      amountWaived: '400',
      metadata: {
        adjustments: [
          { type: 'discount', amount: 400, reason: 'Staff discount approved', by: 'admin-1' },
        ],
      },
    });
    expect(chargeRemaining(row)).toBe(0);
    expect(
      evaluateDiagnosticClearance({
        serviceLine: 'laboratory',
        serviceEntityId: REQUEST,
        charge: row,
        transactions: [txn({ amount: '600' })],
      }),
    ).toMatchObject({ cleared: true, reason: 'paid' });
  });
});
