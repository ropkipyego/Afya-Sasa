import { assertLabTransition } from './lab-lifecycle';

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
