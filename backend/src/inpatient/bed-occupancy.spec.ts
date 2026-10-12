import { bedBlockedByActiveAdmission, bedClaimSucceeded } from './bed-occupancy';

describe('bed occupancy claims', () => {
  it('treats a zero-row update as a lost race on the same bed', () => {
    expect(bedClaimSucceeded(1)).toBe(true);
    expect(bedClaimSucceeded(0)).toBe(false);
    expect(bedClaimSucceeded(undefined)).toBe(false);
  });

  it('blocks a second active admission on an already occupied bed', () => {
    expect(bedBlockedByActiveAdmission(null)).toBe(false);
    expect(bedBlockedByActiveAdmission('adm-existing')).toBe(true);
  });
});
