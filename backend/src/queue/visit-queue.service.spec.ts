import { nextToken } from './visit-queue.service';

describe('nextToken', () => {
  it('starts a department series at 001', () => {
    expect(nextToken('OPD')).toBe('OPD-001');
  });

  it('increments the daily suffix without colliding', () => {
    expect(nextToken('LAB', 'LAB-014')).toBe('LAB-015');
    expect(nextToken('PHARM', 'PHARM-099')).toBe('PHARM-100');
  });
});
