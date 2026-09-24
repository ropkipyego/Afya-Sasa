import { aliasLabCatalogHeader, normalizeLabName, parseLabSell, readLabTestPricing } from './lab-pricing';

describe('lab pricing', () => {
  it('reads sell prices keyed by test code', () => {
    expect(readLabTestPricing({ labTestPricing: { FBC: { sell: 800 }, MP: 350 } })).toEqual({
      FBC: { sell: 800 },
      MP: { sell: 350 },
    });
  });

  it('aliases hospital price columns', () => {
    expect(aliasLabCatalogHeader('RATE')).toBe('sell');
    expect(aliasLabCatalogHeader('Selling Price')).toBe('sell');
    expect(aliasLabCatalogHeader('test name')).toBe('name');
  });

  it('normalizes hospital test names for matching', () => {
    expect(normalizeLabName('Albumin, Serum')).toBe(normalizeLabName('Albumin'));
    expect(normalizeLabName('HBsAg')).toBe('hbsag');
  });

  it('parses a rate from a catalog row', () => {
    expect(parseLabSell({ rate: '450' })).toBe(450);
    expect(parseLabSell({ name: 'FBC' })).toBeNull();
  });
});
