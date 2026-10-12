import {
  MailConfigurationError,
  mailReadyToSend,
  nodemailerTransportOptions,
  parseMailConfig,
  recipientAllowed,
  resolveTlsMode,
} from './mail.config';

describe('mail.config', () => {
  it('is NOT_CONFIGURED when host is missing or delivery is disabled', () => {
    const disabled = parseMailConfig({ SMTP_HOST: 'mail.example', EMAIL_DELIVERY_ENABLED: 'false' });
    expect(mailReadyToSend(disabled).ok).toBe(false);
    const noHost = parseMailConfig({ EMAIL_DELIVERY_ENABLED: 'true', SMTP_HOST: '' });
    expect(mailReadyToSend(noHost).ok).toBe(false);
  });

  it('rejects TLS off', () => {
    expect(() => resolveTlsMode(587, 'off')).toThrow(MailConfigurationError);
  });

  it('enforces certificate verification on the transport', () => {
    const config = parseMailConfig({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      EMAIL_DELIVERY_ENABLED: 'true',
      SMTP_USER: 'noreply',
      SMTP_PASSWORD: 'super-secret-password',
    });
    const options = nodemailerTransportOptions(config);
    expect(options.tls.rejectUnauthorized).toBe(true);
    expect(options.requireTLS).toBe(true);
    expect(options.secure).toBe(false);
  });

  it('uses implicit TLS on port 465', () => {
    const options = nodemailerTransportOptions(
      parseMailConfig({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', EMAIL_DELIVERY_ENABLED: 'true' }),
    );
    expect(options.secure).toBe(true);
  });

  it('defaults the sender to noreply@jalaram.co.ke', () => {
    expect(parseMailConfig({}).fromAddress).toBe('noreply@jalaram.co.ke');
  });

  it('does not treat an empty allowlist as safe unless unrestricted recipients are explicit', () => {
    const staging = parseMailConfig({});
    expect(recipientAllowed(staging, 'anyone@jalaram.co.ke')).toBe(false);
    const unrestricted = parseMailConfig({ EMAIL_ALLOW_UNRESTRICTED_RECIPIENTS: 'true' });
    expect(recipientAllowed(unrestricted, 'anyone@jalaram.co.ke')).toBe(true);
    const listed = parseMailConfig({
      EMAIL_RECIPIENT_ALLOWLIST: 'ict@jalaram.co.ke, director@jalaram.co.ke',
    });
    expect(recipientAllowed(listed, 'ict@jalaram.co.ke')).toBe(true);
    expect(recipientAllowed(listed, 'ward@jalaram.co.ke')).toBe(false);
  });

  it('refuses a sender other than noreply@jalaram.co.ke', () => {
    const config = parseMailConfig({
      EMAIL_DELIVERY_ENABLED: 'true',
      SMTP_HOST: 'mail.jalaram.co.ke',
      SMTP_USER: 'noreply@jalaram.co.ke',
      SMTP_PASSWORD: 'x',
      SMTP_FROM: 'other@jalaram.co.ke',
      EMAIL_RECIPIENT_ALLOWLIST: 'ict@jalaram.co.ke',
    });
    expect(mailReadyToSend(config).ok).toBe(false);
  });

  it('defaults SMTP to port 465 implicit TLS for the Jalaram mailbox', () => {
    expect(parseMailConfig({}).port).toBe(465);
    expect(parseMailConfig({}).tlsMode).toBe('implicit');
  });
});
