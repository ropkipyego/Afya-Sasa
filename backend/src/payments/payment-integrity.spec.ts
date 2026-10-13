import {
  allocatePayment,
  cashierTotals,
  payerMixFromMethods,
  paymentKind,
  remainingBalance,
} from './payment-integrity';

describe('payment integrity', () => {
  it('does not treat a charge remaining of zero as a new payment', () => {
    expect(remainingBalance(1000, 600, 400)).toBe(0);
    expect(() => allocatePayment(0, 100)).toThrow(/exceeds remaining/);
  });

  it('allows a partial allocation without marking the charge paid', () => {
    expect(allocatePayment(500, 200)).toEqual({
      allocated: 200,
      remaining: 300,
      fullyPaid: false,
    });
  });

  it('excludes refunds from cashier collections', () => {
    const totals = cashierTotals([
      { method: 'cash', amount: 100, status: 'completed', metadata: { kind: 'payment' } },
      { method: 'cash', amount: 40, status: 'completed', metadata: { kind: 'refund' } },
      { method: 'insurance', amount: 80, status: 'completed' },
      { method: 'cash', amount: 10, status: 'failed' },
    ]);
    expect(totals.collections).toBe(180);
    expect(totals.refunds).toBe(40);
    expect(payerMixFromMethods(totals.collectionsByMethod)).toMatchObject({
      patientPayments: 100,
      insuranceRecorded: 80,
    });
  });

  it('classifies metadata.kind', () => {
    expect(paymentKind({ kind: 'refund' })).toBe('refund');
    expect(paymentKind(null)).toBe('payment');
  });
});
