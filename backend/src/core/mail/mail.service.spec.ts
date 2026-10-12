import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';
import { redactSecrets } from './mail.redact';

function repo(overrides: Record<string, unknown> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => ({ id: 'd1', ...row })),
    update: jest.fn(),
    ...overrides,
  };
}

function service(repoMock = repo()) {
  const mail = new MailService(repoMock as never);
  mail.sleep = jest.fn().mockResolvedValue(undefined);
  return { mail, repoMock };
}

const enabledEnv = {
  EMAIL_DELIVERY_ENABLED: 'true',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_TLS_MODE: 'starttls',
  SMTP_USER: 'mail-user',
  SMTP_PASSWORD: 'mail-secret-value',
  SMTP_FROM: 'noreply@jalaram.co.ke',
  EMAIL_PUBLIC_ORIGIN: 'https://emr.jalaram.co.ke',
  EMAIL_ALLOW_UNRESTRICTED_RECIPIENTS: 'true',
} as NodeJS.ProcessEnv;

describe('MailService', () => {
  it('does not send when SMTP is missing', async () => {
    const { mail } = service();
    const result = await mail.send(
      {
        to: 'nurse@jalaram.co.ke',
        purpose: 'system_alert',
        subject: 'Alert',
        text: 'down',
        html: '<p>down</p>',
        idempotencyKey: 'k1',
      },
      { EMAIL_DELIVERY_ENABLED: 'true' },
    );
    expect(result.accepted).toBe(false);
    expect(result.status).toBe('NOT_CONFIGURED');
  });

  it('does not report success until the provider accepts the message', async () => {
    const { mail } = service();
    mail.createTransport = () =>
      ({
        sendMail: jest.fn().mockResolvedValue({ accepted: [], rejected: ['nurse@jalaram.co.ke'] }),
      }) as never;
    const result = await mail.send(
      {
        to: 'nurse@jalaram.co.ke',
        purpose: 'system_alert',
        subject: 'Alert',
        text: 'x',
        html: 'x',
        idempotencyKey: 'k2',
      },
      enabledEnv,
    );
    expect(result.accepted).toBe(false);
    expect(result.status).toBe('FAILED');
  });

  it('retries on timeout then succeeds without duplicate provider calls after accept', async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValueOnce(new Error('Greeting never received'))
      .mockResolvedValue({ accepted: ['nurse@jalaram.co.ke'], rejected: [], messageId: '<id@smtp>' });
    const { mail } = service();
    mail.createTransport = () => ({ sendMail }) as never;
    const first = await mail.send(
      {
        to: 'nurse@jalaram.co.ke',
        purpose: 'system_alert',
        subject: 'Alert',
        text: 'x',
        html: 'x',
        idempotencyKey: 'k3',
      },
      enabledEnv,
    );
    expect(first.accepted).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(2);

    const { mail: mail2 } = service(
      repo({
        findOne: jest.fn().mockResolvedValue({
          id: 'd1',
          acceptedAt: new Date(),
          attempts: 2,
          providerMessageId: '<id@smtp>',
        }),
      }),
    );
    mail2.createTransport = () => ({ sendMail: jest.fn() }) as never;
    const second = await mail2.send(
      {
        to: 'nurse@jalaram.co.ke',
        purpose: 'system_alert',
        subject: 'Alert',
        text: 'x',
        html: 'x',
        idempotencyKey: 'k3',
      },
      enabledEnv,
    );
    expect(second.duplicate).toBe(true);
    expect(second.accepted).toBe(true);
  });

  it('redacts SMTP secrets from logged failures', async () => {
    const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { mail } = service();
    mail.createTransport = () =>
      ({
        sendMail: jest.fn().mockRejectedValue(new Error('auth failed for mail-secret-value')),
      }) as never;
    await mail.send(
      {
        to: 'nurse@jalaram.co.ke',
        purpose: 'password_reset',
        subject: 'Reset',
        text: 'token=SUPERSECRETTOKEN',
        html: 'token=SUPERSECRETTOKEN',
        idempotencyKey: 'k4',
      },
      enabledEnv,
    );
    const logged = spy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(logged).not.toContain('mail-secret-value');
    expect(logged).not.toContain('SUPERSECRETTOKEN');
    spy.mockRestore();
  });

  it('refuses to build http reset URLs in production', () => {
    const { mail } = service();
    expect(() =>
      mail.buildPasswordResetUrl('raw-token', 'jalaram', {
        NODE_ENV: 'production',
        APP_PUBLIC_URL: 'http://localhost:8080',
      }),
    ).toThrow(/https/i);
  });

  it('does not send when the recipient is outside EMAIL_RECIPIENT_ALLOWLIST', async () => {
    const sendMail = jest.fn();
    const { mail } = service();
    mail.createTransport = () => ({ sendMail }) as never;
    const result = await mail.send(
      {
        to: 'ward@jalaram.co.ke',
        purpose: 'password_reset',
        subject: 'Reset',
        text: 'x',
        html: 'x',
        idempotencyKey: 'k-allow',
      },
      {
        ...enabledEnv,
        EMAIL_ALLOW_UNRESTRICTED_RECIPIENTS: 'false',
        EMAIL_RECIPIENT_ALLOWLIST: 'ict@jalaram.co.ke',
      },
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/ALLOWLIST/);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does not send operational mail when that policy is disabled', async () => {
    const sendMail = jest.fn();
    const { mail } = service();
    mail.createTransport = () => ({ sendMail }) as never;
    const result = await mail.send(
      {
        to: 'nurse@jalaram.co.ke',
        purpose: 'system_alert',
        subject: 'Alert',
        text: 'x',
        html: 'x',
        idempotencyKey: 'k-policy',
      },
      { ...enabledEnv, EMAIL_POLICY_OPERATIONAL: 'false' },
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/policy/i);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('records SMTP verification failure without claiming recipient delivery', async () => {
    const { mail } = service();
    mail.createTransport = () =>
      ({
        verify: jest.fn().mockRejectedValue(new Error('Invalid login mail-secret-value')),
      }) as never;
    const result = await mail.verifyConnection(enabledEnv);
    expect(result.ok).toBe(false);
    expect(result.reason).not.toContain('mail-secret-value');
    const status = mail.diagnostics(enabledEnv);
    expect(status.recipientDelivered).toBe(false);
    expect(JSON.stringify(status)).not.toContain('mail-secret-value');
  });

  it('never uses an incoming Host header for reset URLs', () => {
    const { mail } = service();
    const url = mail.buildPasswordResetUrl('raw-token', 'jalaram', {
      EMAIL_PUBLIC_ORIGIN: 'https://emr.jalaram.co.ke',
      HTTP_HOST: 'evil.example',
    });
    expect(url.startsWith('https://emr.jalaram.co.ke')).toBe(true);
    expect(url).not.toContain('evil.example');
  });
});

describe('redactSecrets', () => {
  it('strips password-like values', () => {
    expect(redactSecrets('password=abc token=zzz', ['abc'])).toContain('[REDACTED]');
    expect(redactSecrets('password=abc token=zzz', ['abc'])).not.toContain('abc');
  });
});
