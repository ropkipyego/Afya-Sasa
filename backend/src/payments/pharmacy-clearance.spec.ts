import { evaluatePharmacyClearance, readCreditApproval } from './pharmacy-clearance';

const charge = {
  id: 'chg-1',
  serviceLine: 'pharmacy' as const,
  serviceEntityId: 'sale-1',
  status: 'owed' as const,
  amountOwed: '100',
  amountPaid: '0',
  amountWaived: '0',
  metadata: null as Record<string, unknown> | null,
};

describe('evaluatePharmacyClearance', () => {
  it('denies when charges are disabled', () => {
    expect(
      evaluatePharmacyClearance({
        serviceEntityId: 'sale-1',
        chargesEnabled: false,
        charge,
      }),
    ).toMatchObject({ cleared: false, reason: 'charges_disabled' });
  });

  it('denies a missing charge', () => {
    expect(
      evaluatePharmacyClearance({
        serviceEntityId: 'sale-1',
        chargesEnabled: true,
        charge: null,
      }),
    ).toMatchObject({ cleared: false, reason: 'missing_charge' });
  });

  it('denies an unpaid bill', () => {
    const decision = evaluatePharmacyClearance({
      serviceEntityId: 'sale-1',
      chargesEnabled: true,
      charge,
    });
    expect(decision.cleared).toBe(false);
    expect(decision.reason).toBe('unpaid');
    expect(decision.message).toMatch(/outstanding/);
  });

  it('denies a partial payment without credit', () => {
    const decision = evaluatePharmacyClearance({
      serviceEntityId: 'sale-1',
      chargesEnabled: true,
      charge: { ...charge, amountPaid: '40', status: 'partially_paid' },
      transactions: [{ chargeId: 'chg-1', status: 'completed', method: 'cash', amount: '40' }],
    });
    expect(decision).toMatchObject({ cleared: false, reason: 'partial_payment' });
  });

  it('allows a documented credit that covers the remainder', () => {
    const decision = evaluatePharmacyClearance({
      serviceEntityId: 'sale-1',
      chargesEnabled: true,
      charge: {
        ...charge,
        amountPaid: '40',
        status: 'partially_paid',
        metadata: {
          creditApproval: {
            by: 'manager-1',
            at: '2026-10-22T10:00:00.000Z',
            reason: 'Director authorised staff account',
            amount: 60,
          },
        },
      },
      transactions: [{ chargeId: 'chg-1', status: 'completed', method: 'cash', amount: '40' }],
    });
    expect(decision).toMatchObject({ cleared: true, reason: 'credit' });
  });

  it('allows verified cash that settles the charge', () => {
    const decision = evaluatePharmacyClearance({
      serviceEntityId: 'sale-1',
      chargesEnabled: true,
      charge: { ...charge, amountPaid: '100', status: 'paid' },
      transactions: [{ chargeId: 'chg-1', status: 'completed', method: 'cash', amount: '100' }],
    });
    expect(decision).toMatchObject({ cleared: true, reason: 'paid' });
  });

  it('does not treat cashier insurance as collected money', () => {
    const decision = evaluatePharmacyClearance({
      serviceEntityId: 'sale-1',
      chargesEnabled: true,
      charge: { ...charge, amountPaid: '100', status: 'paid' },
      transactions: [{ chargeId: 'chg-1', status: 'completed', method: 'insurance', amount: '100' }],
    });
    expect(decision).toMatchObject({ cleared: false, reason: 'not_collected_money' });
  });

  it('rejects an undocumented waived payment method', () => {
    const decision = evaluatePharmacyClearance({
      serviceEntityId: 'sale-1',
      chargesEnabled: true,
      charge: { ...charge, amountWaived: '100', status: 'waived' },
      transactions: [{ chargeId: 'chg-1', status: 'completed', method: 'waived', amount: '100' }],
    });
    expect(decision).toMatchObject({ cleared: false, reason: 'unverified_waiver' });
  });

  it('allows a documented exemption adjustment', () => {
    const decision = evaluatePharmacyClearance({
      serviceEntityId: 'sale-1',
      chargesEnabled: true,
      charge: {
        ...charge,
        amountWaived: '100',
        status: 'waived',
        metadata: {
          adjustments: [
            { type: 'waiver', amount: 100, reason: 'Director authorised staff exemption', by: 'mgr-1' },
          ],
        },
      },
    });
    expect(decision).toMatchObject({ cleared: true, reason: 'waived' });
  });
});

describe('readCreditApproval', () => {
  it('rejects incomplete credit metadata', () => {
    expect(readCreditApproval({ creditApproval: { by: 'x', amount: 10 } })).toBeNull();
  });
});
