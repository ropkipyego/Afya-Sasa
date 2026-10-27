import { assertLabTransition, duplicateOpenLabOrder } from './lab-lifecycle';

describe('lab lifecycle transitions', () => {
  it('allows collection from requested and blocks collection after verification', () => {
    expect(() => assertLabTransition('requested', 'sample_collected', 'collect')).not.toThrow();
    expect(() => assertLabTransition('verified', 'sample_collected', 'collect')).toThrow(/Cannot collect/);
  });

  it('allows cancel before verification and rejects cancel after verification', () => {
    expect(() => assertLabTransition('requested', 'cancelled', 'cancel')).not.toThrow();
    expect(() => assertLabTransition('resulted', 'cancelled', 'cancel')).not.toThrow();
    expect(() => assertLabTransition('verified', 'cancelled', 'cancel')).toThrow(/Cannot cancel/);
  });

  it('does not allow skipping from requested to verified', () => {
    expect(() => assertLabTransition('requested', 'verified', 'verify')).toThrow();
  });

  it('does not allow a cancelled request to return to processing', () => {
    expect(() => assertLabTransition('cancelled', 'processing', 'receive')).toThrow();
    expect(() => assertLabTransition('verified', 'resulted', 'enter')).toThrow();
  });
});

describe('duplicate open laboratory orders', () => {
  it('detects a second FBC while the first is still open', () => {
    expect(
      duplicateOpenLabOrder(
        [{ testId: 't-fbc', label: 'FBC' }],
        [{ testId: 't-fbc', label: 'FBC', requestNo: 'LAB-1' }],
      ),
    ).toMatchObject({ label: 'FBC', requestNo: 'LAB-1' });
  });

  it('allows a repeat after the previous order is no longer in the open set', () => {
    expect(duplicateOpenLabOrder([{ testId: 't-fbc', label: 'FBC' }], [])).toBeNull();
  });

  it('does not treat a different catalog test as a duplicate', () => {
    expect(
      duplicateOpenLabOrder(
        [{ testId: 't-uec', label: 'UEC' }],
        [{ testId: 't-fbc', label: 'FBC', requestNo: 'LAB-1' }],
      ),
    ).toBeNull();
  });
});
