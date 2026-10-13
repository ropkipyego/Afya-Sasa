import { pickServiceLineTotals, visibleServiceLines } from './department-revenue';

describe('department revenue visibility', () => {
  it('shows every line to directors and cashiers', () => {
    expect(visibleServiceLines({ roles: ['director'] })).toBe('all');
    expect(visibleServiceLines({ permissions: ['payments:initiate'] })).toBe('all');
  });

  it('limits laboratory staff to laboratory totals', () => {
    expect(visibleServiceLines({ permissions: ['lab_requests:read'] })).toEqual(['laboratory']);
    expect(
      pickServiceLineTotals(
        { laboratory: 100, pharmacy: 50 },
        ['laboratory'],
      ),
    ).toEqual({ laboratory: 100 });
  });
});
