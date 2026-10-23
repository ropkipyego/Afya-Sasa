import { availableQuantity, assertEnoughAvailable } from './stock-available';

describe('availableQuantity', () => {
  it('subtracts held reservations from on-hand without going through the ledger', () => {
    expect(availableQuantity(10, 3)).toBe(7);
    expect(availableQuantity(10, 0)).toBe(10);
  });

  it('can be negative before clamping at the assertion', () => {
    expect(availableQuantity(2, 5)).toBe(-3);
  });
});

describe('assertEnoughAvailable', () => {
  it('allows an exact last-unit reserve', () => {
    expect(() => assertEnoughAvailable(2, 2)).not.toThrow();
  });

  it('refuses over-reservation', () => {
    expect(() => assertEnoughAvailable(1, 2, 'Paracetamol')).toThrow(/Insufficient available stock/);
  });
});
