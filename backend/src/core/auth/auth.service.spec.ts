import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

function auth(overrides: Record<string, unknown> = {}) {
  const passwordResetTokens = {
    save: jest.fn(async (row) => row),
    create: jest.fn((row) => row),
    update: jest.fn(),
    findOne: jest.fn(),
  };
  const users = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const refreshTokens = {
    update: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => ({ id: 's1', ...row })),
  };
  const instance = new AuthService(
    { signAsync: jest.fn() } as never,
    {
      get: jest.fn((key: string) =>
        ({
          PASSWORD_RESET_TTL_MINUTES: '30',
          PASSWORD_RESET_RATE_LIMIT: '5',
          PASSWORD_RESET_RATE_WINDOW_SECONDS: '900',
        }[key]),
      ),
    } as never,
    {
      findByEmail: jest.fn(),
      collectRolesAndPermissions: jest.fn().mockResolvedValue({ roles: ['nurse'], permissions: [] }),
    } as never,
    { record: jest.fn() } as never,
    {
      sendPasswordReset: jest.fn().mockResolvedValue({ accepted: false, status: 'NOT_CONFIGURED' }),
      sendPasswordChanged: jest.fn().mockResolvedValue({ accepted: false, status: 'NOT_CONFIGURED' }),
    } as never,
    {
      consumeRateLimit: jest.fn().mockResolvedValue({ allowed: true, count: 1 }),
      invalidateUser: jest.fn(),
      clearSessionActivity: jest.fn(),
      bindSessionTenant: jest.fn(),
      getSessionTenant: jest.fn().mockResolvedValue('jalaram'),
      clearSessionTenant: jest.fn(),
    } as never,
    refreshTokens as never,
    users as never,
    passwordResetTokens as never,
  );
  Object.assign(instance, overrides);
  return { instance, passwordResetTokens, users, refreshTokens };
}

describe('AuthService password reset', () => {
  it('returns the same generic message for existing and nonexistent accounts', async () => {
    const existing = auth();
    (existing.instance as unknown as { usersService: { findByEmail: jest.Mock } }).usersService = {
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', email: 'nurse@jalaram.co.ke' }),
    } as never;
    const missing = auth();
    (missing.instance as unknown as { usersService: { findByEmail: jest.Mock } }).usersService = {
      findByEmail: jest.fn().mockResolvedValue(null),
    } as never;

    const a = await existing.instance.requestPasswordReset('nurse@jalaram.co.ke', '1.1.1.1', 'jalaram');
    const b = await missing.instance.requestPasswordReset('nobody@jalaram.co.ke', '1.1.1.1', 'jalaram');
    expect(a.message).toBe(b.message);
    expect(a).not.toHaveProperty('resetToken');
    expect(b).not.toHaveProperty('resetToken');
  });

  it('stores a hashed token rather than the raw secret', async () => {
    const { instance, passwordResetTokens } = auth();
    (instance as unknown as { usersService: { findByEmail: jest.Mock } }).usersService = {
      findByEmail: jest.fn().mockResolvedValue({ id: 'u1', email: 'nurse@jalaram.co.ke' }),
    } as never;
    await instance.requestPasswordReset('nurse@jalaram.co.ke');
    const saved = passwordResetTokens.create.mock.calls[0][0];
    expect(saved.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(saved)).not.toMatch(/resetToken/);
  });

  it('rate-limits reset requests with a generic response', async () => {
    const { instance } = auth();
    (instance as unknown as { tokenRevocation: { consumeRateLimit: jest.Mock } }).tokenRevocation = {
      consumeRateLimit: jest.fn().mockResolvedValue({ allowed: false, count: 9 }),
    } as never;
    const result = await instance.requestPasswordReset('nurse@jalaram.co.ke', '9.9.9.9');
    expect(result.message).toMatch(/If an account exists/);
  });

  it('rejects expired and reused tokens', async () => {
    const { instance, passwordResetTokens } = auth();
    passwordResetTokens.findOne.mockResolvedValue(null);
    await expect(instance.resetPassword('expired', 'NewPassword123')).rejects.toBeInstanceOf(BadRequestException);

    passwordResetTokens.findOne.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    await expect(instance.resetPassword('stale', 'NewPassword123')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revokes sessions after a successful reset and does not sign the user in', async () => {
    const { instance, passwordResetTokens, users, refreshTokens } = auth();
    passwordResetTokens.findOne.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    users.findOne.mockResolvedValue({ id: 'u1', email: 'nurse@jalaram.co.ke' });
    const result = await instance.resetPassword('good-token', 'NewPassword123');
    expect(result).toEqual(
      expect.objectContaining({ message: expect.stringContaining('Sign in with your new password') }),
    );
    expect(result).not.toHaveProperty('accessToken');
    const revocation = (instance as unknown as { tokenRevocation: { invalidateUser: jest.Mock } }).tokenRevocation;
    expect(revocation.invalidateUser).toHaveBeenCalledWith('u1');
    expect(refreshTokens.update).toHaveBeenCalled();
  });
});
