import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { hashOtp } from './mfa-otp';

describe('MfaService flag gate', () => {
  it('refuses to issue or verify codes while AUTH_MFA_OTP_ENABLED is off', async () => {
    const service = new MfaService(
      { get: jest.fn().mockReturnValue('false') } as never,
      {
        consumeRateLimit: jest.fn(),
        getEphemeral: jest.fn(),
        putEphemeral: jest.fn(),
        deleteEphemeral: jest.fn(),
      } as never,
    );
    expect(service.status()).toEqual(
      expect.objectContaining({ otpEnabled: false, otpRequired: false, totpEnabled: false }),
    );
    await expect(
      service.issueLoginChallenge({ userId: 'u1', email: 'nurse@jalaram.co.ke' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.verify({ challengeId: 'x', code: '123456' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects expired and replayed challenges when the local flag is on', async () => {
    const store = new Map<string, string>();
    const tokens = {
      consumeRateLimit: jest.fn().mockResolvedValue({ allowed: true, count: 1 }),
      getEphemeral: jest.fn(async (key: string) => store.get(key) ?? null),
      putEphemeral: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      deleteEphemeral: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    };
    const service = new MfaService(
      {
        get: jest.fn((key: string) =>
          key === 'AUTH_MFA_OTP_ENABLED' ? 'true' : key === 'AUTH_MFA_OTP_PEPPER' ? 'pepper' : 'false',
        ),
      } as never,
      tokens as never,
    );
    const challengeId = 'chg_replay';
    store.set(
      `auth:mfa:challenge:${challengeId}`,
      JSON.stringify({
        userId: 'u1',
        email: 'nurse@jalaram.co.ke',
        purpose: 'login',
        codeHash: hashOtp('847291', challengeId, 'pepper'),
        expiresAt: Date.now() - 1,
        attempts: 0,
      }),
    );
    await expect(service.verify({ challengeId, code: '847291' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    store.set(
      `auth:mfa:challenge:${challengeId}`,
      JSON.stringify({
        userId: 'u1',
        email: 'nurse@jalaram.co.ke',
        purpose: 'login',
        codeHash: hashOtp('847291', challengeId, 'pepper'),
        expiresAt: Date.now() + 60_000,
        attempts: 0,
      }),
    );
    await expect(service.verify({ challengeId, code: '847291' })).resolves.toEqual(
      expect.objectContaining({ userId: 'u1' }),
    );
    await expect(service.verify({ challengeId, code: '847291' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
