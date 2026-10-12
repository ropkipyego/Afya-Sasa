import { canTransitionRadiology, radiologyReportIsLocked } from './radiology-lifecycle';

describe('radiology lifecycle', () => {
  it('allows requested → in_progress → reported → verified', () => {
    expect(canTransitionRadiology('requested', 'in_progress')).toBe(true);
    expect(canTransitionRadiology('in_progress', 'reported')).toBe(true);
    expect(canTransitionRadiology('reported', 'verified')).toBe(true);
  });

  it('rejects verified → reported and cancelled → in_progress', () => {
    expect(canTransitionRadiology('verified', 'reported')).toBe(false);
    expect(canTransitionRadiology('cancelled', 'in_progress')).toBe(false);
  });

  it('treats a verified timestamp as a locked report', () => {
    expect(radiologyReportIsLocked(null)).toBe(false);
    expect(radiologyReportIsLocked(new Date().toISOString())).toBe(true);
  });
});
