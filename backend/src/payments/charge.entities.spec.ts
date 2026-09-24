import { chargeRemaining } from './charge.entities';

describe('operational charge remaining', () => {
  it('supports staged payments on one charge', () => {
    const charge = { amountOwed: '495', amountPaid: '350', amountWaived: '0' };
    expect(chargeRemaining(charge)).toBe(145);
  });

  it('never goes negative', () => {
    expect(chargeRemaining({ amountOwed: '100', amountPaid: '100', amountWaived: '20' })).toBe(0);
  });
});
