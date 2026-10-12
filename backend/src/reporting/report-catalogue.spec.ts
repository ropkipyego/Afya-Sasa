import { catalogueForPermissions } from './report-catalogue';

describe('report catalogue', () => {
  it('does not expose finance exports to a clinical reports reader without payments:read', () => {
    const items = catalogueForPermissions(['reports:read']);
    const finance = items.find((row) => row.id === 'finance');
    expect(finance?.available).toBe(false);
  });

  it('marks implemented director analytics as available to reports:read', () => {
    const items = catalogueForPermissions(['reports:read']);
    expect(items.find((row) => row.id === 'executive-analytics')?.available).toBe(true);
    expect(items.every((row) => row.source)).toBe(true);
  });
});
