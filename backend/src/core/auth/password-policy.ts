export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const WEAK = new Set([
  'password123',
  'password1234',
  'changeme123',
  'changeme123!',
  'admin12345',
  'welcome123',
  'jalaram123',
  'hospital123',
]);

export function validateNewPassword(
  password: string,
  extras?: { email?: string; currentPassword?: string },
): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  if (/\s/.test(password)) {
    return 'Password cannot contain spaces';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number';
  }
  if (WEAK.has(password.toLowerCase())) {
    return 'Choose a stronger password';
  }
  const local = extras?.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) {
    return 'Password must not include your email name';
  }
  if (extras?.currentPassword && password === extras.currentPassword) {
    return 'New password must be different from the current password';
  }
  return null;
}

export function assertPasswordsMatch(password: string, confirmation?: string) {
  if (typeof confirmation === 'string' && confirmation !== password) {
    return 'New password and confirmation do not match';
  }
  return null;
}
