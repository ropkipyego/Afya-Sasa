import { classifyInventoryMatch, likelyNameMatch, normalizeProductName } from './inventory-import-match';

describe('inventory catalogue import matching', () => {
  it('normalizes product names for comparison', () => {
    expect(normalizeProductName('Paracetamol 500mg Tablet')).toBe('paracetamol 500mg tablet');
  });

  it('classifies exact SKU matches separately from new rows', () => {
    expect(
      classifyInventoryMatch({
        sku: 'PARA500',
        name: 'Paracetamol',
        existingBySku: { sku: 'PARA500', name: 'Paracetamol 500mg' },
      }).match,
    ).toBe('exact_sku');
    expect(classifyInventoryMatch({ sku: 'NEW1', name: 'Brand new syrup' }).match).toBe('new');
  });

  it('flags likely name matches so they are not auto-applied', () => {
    expect(likelyNameMatch('Paracetamol 500mg tablet', 'Paracetamol 500 mg tablets')).toBe(true);
    expect(
      classifyInventoryMatch({
        sku: 'X1',
        name: 'Paracetamol 500mg tablet',
        existingByName: { sku: 'PARA500', name: 'Paracetamol 500mg tablet' },
      }).match,
    ).toBe('exact_name');
  });
});
