import { isExpiredBatch } from './inventory.service';

describe('isExpiredBatch', () => {
  const now = new Date('2026-09-23T10:00:00.000Z');

  it('treats missing expiry as usable', () => {
    expect(isExpiredBatch(null, now)).toBe(false);
    expect(isExpiredBatch(undefined, now)).toBe(false);
  });

  it('keeps stock usable on the expiry date', () => {
    expect(isExpiredBatch('2026-09-23', now)).toBe(false);
  });

  it('rejects lots that expired yesterday', () => {
    expect(isExpiredBatch('2026-09-22', now)).toBe(true);
  });
});
