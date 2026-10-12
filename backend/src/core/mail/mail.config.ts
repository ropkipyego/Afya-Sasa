import type { MailRuntimeConfig, SmtpTlsMode } from './mail.types';
import {
  APPROVED_SENDER,
  DEFAULT_MAIL_POLICIES,
  isValidEmailAddress,
  normalizeEmailAddress,
  parseEmailList,
  purposeCategory,
  senderIsApproved,
  type MailOverlay,
} from './mail.policy';
import type { MailPurpose } from './mail.types';

const DEFAULT_FROM_NAME = 'Jalaram Hospital';

export class MailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailConfigurationError';
  }
}

function envBool(value: string | undefined, fallback = false): boolean {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function envInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function resolveTlsMode(port: number, explicit?: string | null): SmtpTlsMode {
  const mode = explicit?.trim().toLowerCase();
  if (mode === 'implicit' || mode === 'tls' || mode === 'ssl' || mode === 'true' || mode === '1') {
    return 'implicit';
  }
  if (mode === 'starttls' || mode === 'false' || mode === '0') return 'starttls';
  if (mode === 'off' || mode === 'none') {
    throw new MailConfigurationError(
      'SMTP_TLS_MODE=off is not allowed. TLS with certificate verification is required.',
    );
  }
  return port === 465 ? 'implicit' : 'starttls';
}

export function parseMailConfig(env: NodeJS.ProcessEnv = process.env): MailRuntimeConfig {
  const port = envInt(env.SMTP_PORT, 465);
  const tlsMode = resolveTlsMode(port, env.SMTP_TLS_MODE ?? env.SMTP_SECURE);
  const host = env.SMTP_HOST?.trim() || null;
  const publicOrigin = (
    env.EMAIL_PUBLIC_ORIGIN ||
    env.APP_PUBLIC_URL ||
    env.FRONTEND_ORIGIN ||
    ''
  )
    .trim()
    .replace(/\/$/, '') || null;

  const fromAddress = normalizeEmailAddress(env.SMTP_FROM?.trim() || APPROVED_SENDER);

  return {
    deliveryEnabled: envBool(env.EMAIL_DELIVERY_ENABLED, false),
    host,
    port,
    tlsMode,
    username: env.SMTP_USER?.trim() || null,
    password: env.SMTP_PASSWORD || null,
    fromAddress,
    fromName: env.SMTP_FROM_NAME?.trim() || DEFAULT_FROM_NAME,
    connectionTimeoutMs: envInt(env.SMTP_CONNECTION_TIMEOUT_MS, 10_000),
    maxAttempts: Math.min(envInt(env.SMTP_MAX_ATTEMPTS, 3), 5),
    publicOrigin,
    requireHttpsOrigin: env.NODE_ENV === 'production',
    recipientAllowlist: parseEmailList(env.EMAIL_RECIPIENT_ALLOWLIST),
    allowUnrestrictedRecipients: envBool(env.EMAIL_ALLOW_UNRESTRICTED_RECIPIENTS, false),
    policies: {
      auth: envBool(env.EMAIL_POLICY_AUTH, DEFAULT_MAIL_POLICIES.auth),
      account: envBool(env.EMAIL_POLICY_ACCOUNT, DEFAULT_MAIL_POLICIES.account),
      operational: envBool(env.EMAIL_POLICY_OPERATIONAL, DEFAULT_MAIL_POLICIES.operational),
      reports: envBool(env.EMAIL_POLICY_REPORTS, DEFAULT_MAIL_POLICIES.reports),
    },
  };
}

export function mergeMailConfig(envConfig: MailRuntimeConfig, overlay: MailOverlay): MailRuntimeConfig {
  const allowlist = [...new Set([...envConfig.recipientAllowlist, ...overlay.recipientAllowlist])];
  return {
    ...envConfig,
    deliveryEnabled: envConfig.deliveryEnabled && overlay.operatorDeliveryRequested,
    recipientAllowlist: allowlist,
    policies: {
      auth: envConfig.policies.auth && overlay.policies.auth,
      account: envConfig.policies.account && overlay.policies.account,
      operational: envConfig.policies.operational && overlay.policies.operational,
      reports: envConfig.policies.reports && overlay.policies.reports,
    },
  };
}

export function recipientAllowed(config: MailRuntimeConfig, email: string) {
  if (!isValidEmailAddress(email)) return false;
  const normalized = normalizeEmailAddress(email);
  if (config.allowUnrestrictedRecipients && config.recipientAllowlist.length === 0) {
    return true;
  }
  if (!config.recipientAllowlist.length) return false;
  return config.recipientAllowlist.includes(normalized);
}

export function purposeAllowed(config: MailRuntimeConfig, purpose: MailPurpose) {
  return config.policies[purposeCategory(purpose)] === true;
}

export function mailReadyToSend(config: MailRuntimeConfig): { ok: boolean; reason: string } {
  if (!config.deliveryEnabled) {
    return { ok: false, reason: 'Email delivery is disabled (deployment switch and operator toggle must both be on)' };
  }
  if (!config.host) {
    return { ok: false, reason: 'SMTP_HOST is not configured' };
  }
  if (!config.username || !config.password) {
    return { ok: false, reason: 'SMTP authentication is not configured' };
  }
  if (!senderIsApproved(config.fromAddress)) {
    return { ok: false, reason: `SMTP_FROM must be ${APPROVED_SENDER}` };
  }
  if (!config.allowUnrestrictedRecipients && config.recipientAllowlist.length === 0) {
    return { ok: false, reason: 'EMAIL_RECIPIENT_ALLOWLIST is empty; staging delivery is not safe' };
  }
  return { ok: true, reason: 'configured' };
}

export function assertTrustedResetOrigin(config: MailRuntimeConfig): string {
  if (!config.publicOrigin) {
    throw new MailConfigurationError(
      'EMAIL_PUBLIC_ORIGIN (or APP_PUBLIC_URL / FRONTEND_ORIGIN) is required for reset links',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(config.publicOrigin);
  } catch {
    throw new MailConfigurationError('Trusted frontend origin is not a valid URL');
  }
  if (config.requireHttpsOrigin && parsed.protocol !== 'https:') {
    throw new MailConfigurationError('Password reset links require an https EMAIL_PUBLIC_ORIGIN in production');
  }
  return config.publicOrigin;
}

export function nodemailerTransportOptions(config: MailRuntimeConfig) {
  if (!config.host) {
    throw new MailConfigurationError('SMTP_HOST is not configured');
  }
  return {
    host: config.host,
    port: config.port,
    secure: config.tlsMode === 'implicit',
    requireTLS: config.tlsMode === 'starttls',
    connectionTimeout: config.connectionTimeoutMs,
    greetingTimeout: config.connectionTimeoutMs,
    socketTimeout: config.connectionTimeoutMs,
    tls: {
      rejectUnauthorized: true as const,
      minVersion: 'TLSv1.2' as const,
    },
    auth:
      config.username && config.password
        ? { user: config.username, pass: config.password }
        : undefined,
  };
}
