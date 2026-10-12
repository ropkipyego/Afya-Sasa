import type { MailPurpose } from './mail.types';

export const APPROVED_SENDER = 'noreply@jalaram.co.ke';

export type MailCategory = 'auth' | 'account' | 'operational' | 'reports';

export type MailPolicyFlags = {
  auth: boolean;
  account: boolean;
  operational: boolean;
  reports: boolean;
};

export const DEFAULT_MAIL_POLICIES: MailPolicyFlags = {
  auth: true,
  account: true,
  operational: true,
  reports: true,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(value: string) {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function purposeCategory(purpose: MailPurpose): MailCategory {
  if (purpose === 'password_reset') return 'auth';
  if (purpose === 'password_changed') return 'account';
  if (purpose === 'internal_report' || purpose === 'government_notification') return 'reports';
  return 'operational';
}

export function parseEmailList(raw: string | undefined) {
  return (raw ?? '')
    .split(/[\n,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => isValidEmailAddress(part));
}

export function senderIsApproved(fromAddress: string) {
  return normalizeEmailAddress(fromAddress) === APPROVED_SENDER;
}

export type MailOverlay = {
  operatorDeliveryRequested: boolean;
  recipientAllowlist: string[];
  policies: MailPolicyFlags;
  lastSmtpVerifyAt: string | null;
  lastSmtpVerifyOk: boolean | null;
  lastSmtpVerifyReason: string | null;
  lastTestAt: string | null;
  lastTestAccepted: boolean | null;
  lastTestReason: string | null;
};

export function emptyMailOverlay(): MailOverlay {
  return {
    operatorDeliveryRequested: false,
    recipientAllowlist: [],
    policies: { ...DEFAULT_MAIL_POLICIES },
    lastSmtpVerifyAt: null,
    lastSmtpVerifyOk: null,
    lastSmtpVerifyReason: null,
    lastTestAt: null,
    lastTestAccepted: null,
    lastTestReason: null,
  };
}

export function parseMailOverlay(raw: unknown): MailOverlay {
  const base = emptyMailOverlay();
  if (!raw || typeof raw !== 'object') return base;
  const value = raw as Record<string, unknown>;
  const policies = (value.policies ?? {}) as Record<string, unknown>;
  return {
    operatorDeliveryRequested: value.operatorDeliveryRequested === true,
    recipientAllowlist: Array.isArray(value.recipientAllowlist)
      ? value.recipientAllowlist
          .filter((item): item is string => typeof item === 'string')
          .map(normalizeEmailAddress)
          .filter(isValidEmailAddress)
      : [],
    policies: {
      auth: policies.auth !== false,
      account: policies.account !== false,
      operational: policies.operational !== false,
      reports: policies.reports !== false,
    },
    lastSmtpVerifyAt: typeof value.lastSmtpVerifyAt === 'string' ? value.lastSmtpVerifyAt : null,
    lastSmtpVerifyOk: typeof value.lastSmtpVerifyOk === 'boolean' ? value.lastSmtpVerifyOk : null,
    lastSmtpVerifyReason:
      typeof value.lastSmtpVerifyReason === 'string' ? value.lastSmtpVerifyReason : null,
    lastTestAt: typeof value.lastTestAt === 'string' ? value.lastTestAt : null,
    lastTestAccepted: typeof value.lastTestAccepted === 'boolean' ? value.lastTestAccepted : null,
    lastTestReason: typeof value.lastTestReason === 'string' ? value.lastTestReason : null,
  };
}
