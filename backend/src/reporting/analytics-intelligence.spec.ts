import { compareAgainstBaseline } from './analytics-intelligence';

describe('analytics intelligence', () => {
  it('explains a drop against a prior-period baseline without inventing a claim', () => {
    const finding = compareAgainstBaseline(
      'IPD collections',
      40000,
      80000,
      '2026-09-01 to 2026-09-07',
      'demo.payment_transactions',
    );
    expect(finding?.severity).toBe('info');
    expect(finding?.detail).toContain('40000 compared with a recent average of 80000');
    expect(finding?.source).toBe('demo.payment_transactions');
  });

  it('stays silent when the change is within the 35% band', () => {
    expect(
      compareAgainstBaseline('OPD visits', 110, 100, '2026-09-01 to 2026-09-07', 'demo.encounters'),
    ).toBeNull();
  });
});
