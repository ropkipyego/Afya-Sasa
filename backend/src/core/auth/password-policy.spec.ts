import { assertPasswordsMatch, validateNewPassword } from './password-policy';

describe('password policy', () => {
  it('accepts a sufficiently long mixed password', () => {
    expect(validateNewPassword('WardDesk#2026')).toBeNull();
  });

  it('rejects short, same-as-current, and mismatched confirmation', () => {
    expect(validateNewPassword('short1')).toMatch(/at least 10/);
    expect(validateNewPassword('WardDesk#2026', { currentPassword: 'WardDesk#2026' })).toMatch(
      /different/,
    );
    expect(assertPasswordsMatch('WardDesk#2026', 'WardDesk#2027')).toMatch(/do not match/);
  });
});
