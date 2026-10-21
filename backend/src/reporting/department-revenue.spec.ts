import { pickServiceLineTotals, visibleServiceLines } from './department-revenue';
import { canViewRevenueSummary, summariseCharges, summariseCollections } from './revenue-summary';

describe('department revenue visibility', () => {
  it('shows every line to directors and cashiers', () => {
    expect(visibleServiceLines({ roles: ['director'] })).toBe('all');
    expect(visibleServiceLines({ permissions: ['payments:initiate'] })).toBe('all');
  });

  it('does not treat laboratory read as hospital finance access', () => {
    expect(canViewRevenueSummary({ permissions: ['lab_requests:read'] })).toBe(false);
    expect(canViewRevenueSummary({ permissions: ['reports:read'] })).toBe(false);
    expect(canViewRevenueSummary({ permissions: ['payments:read'] })).toBe(true);
    expect(visibleServiceLines({ permissions: ['lab_requests:read'] })).toEqual(['laboratory']);
    expect(
      pickServiceLineTotals(
        { laboratory: 100, pharmacy: 50 },
        ['laboratory'],
      ),
    ).toEqual({ laboratory: 100 });
  });
});

describe('revenue summary aggregations', () => {
  it('excludes cancelled charges and does not double-count a partial payment as a second charge', () => {
    const result = summariseCharges([
      { amountOwed: 100, amountPaid: 40, amountWaived: 0, status: 'partially_paid', serviceLine: 'pharmacy' },
      { amountOwed: 50, amountPaid: 0, amountWaived: 0, status: 'cancelled', serviceLine: 'pharmacy' },
    ]);
    expect(result.charges).toBe(100);
    expect(result.byServiceLine).toEqual({ pharmacy: 100 });
  });

  it('keeps refunds and waived method separate from collections', () => {
    expect(
      summariseCollections([
        { amount: 80, status: 'completed', method: 'cash', serviceLine: 'consultation' },
        { amount: 20, status: 'completed', method: 'cash', kind: 'refund' },
        { amount: 15, status: 'completed', method: 'waived' },
        { amount: 10, status: 'initiated', method: 'mpesa' },
      ]),
    ).toEqual({ collections: 80, refunds: 20, waivedPayments: 15, byServiceLine: { consultation: 80 } });
  });
});
