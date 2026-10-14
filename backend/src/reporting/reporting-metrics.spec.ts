import { compareDelta, occupancyPercent, sumCountSeries, swallowQueryFailure } from './reporting-metrics';

describe('director metric helpers', () => {
  it('sums daily series without inventing missing days', () => {
    expect(sumCountSeries([{ count: 2 }, { count: 0 }, { count: 5 }])).toBe(7);
    expect(sumCountSeries([])).toBe(0);
  });

  it('returns occupancy only when a bed inventory exists', () => {
    expect(occupancyPercent(7, 10)).toBe(70);
    expect(occupancyPercent(0, 0)).toBeNull();
  });

  it('returns a fallback when an optional director query is missing a column', async () => {
    await expect(
      swallowQueryFailure(async () => {
        throw new Error('column lab.verified_at does not exist');
      }, null),
    ).resolves.toBeNull();
    await expect(swallowQueryFailure(async () => 12, 0)).resolves.toBe(12);
  });

  it('does not invent a percentage when the previous period is zero', () => {
    expect(compareDelta(12, 0)).toEqual({ current: 12, previous: 0, delta: 12, percent: null });
    expect(compareDelta(80, 40).percent).toBe(100);
  });
});
