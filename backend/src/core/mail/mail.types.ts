export type MailTransportStatus =
  | 'NOT_CONFIGURED'
  | 'READY'
  | 'DEGRADED'
  | 'FAILED';

export type MailPurpose =
  | 'password_reset'
  | 'password_changed'
  | 'internal_report'
  | 'system_alert'
  | 'government_notification';

export type SmtpTlsMode = 'starttls' | 'implicit';

export type MailRuntimeConfig = {
  deliveryEnabled: boolean;
  host: string | null;
  port: number;
  tlsMode: SmtpTlsMode;
  username: string | null;
  password: string | null;
  fromAddress: string;
  fromName: string;
  connectionTimeoutMs: number;
  maxAttempts: number;
  publicOrigin: string | null;
  requireHttpsOrigin: boolean;
  recipientAllowlist: string[];
  allowUnrestrictedRecipients: boolean;
  policies: {
    auth: boolean;
    account: boolean;
    operational: boolean;
    reports: boolean;
  };
};

export type MailSendRequest = {
  to: string;
  purpose: MailPurpose;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
  createdBy?: string | null;
};

export type MailSendResult = {
  accepted: boolean;
  status: MailTransportStatus;
  deliveryId?: string;
  providerMessageId?: string | null;
  attempts: number;
  duplicate: boolean;
  reason?: string;
};

export type MailDiagnostics = {
  status: MailTransportStatus;
  deliveryEnabled: boolean;
  deploymentDeliveryEnabled: boolean;
  operatorDeliveryRequested: boolean;
  configurationComplete: boolean;
  smtpVerified: boolean;
  smtpAccepted: boolean;
  recipientDelivered: false;
  smtpHostConfigured: boolean;
  smtpHost: string | null;
  smtpPort: number;
  tlsMode: SmtpTlsMode;
  tlsCertificateVerification: true;
  smtpAuthConfigured: boolean;
  fromAddress: string;
  approvedSender: string;
  senderApproved: boolean;
  publicOriginConfigured: boolean;
  publicOriginUsesHttps: boolean;
  lastAcceptedAt: string | null;
  lastFailureReason: string | null;
  recipientAllowlistConfigured: boolean;
  recipientAllowlist: string[];
  allowUnrestrictedRecipients: boolean;
  policies: {
    auth: boolean;
    account: boolean;
    operational: boolean;
    reports: boolean;
  };
  lastSmtpVerifyAt: string | null;
  lastSmtpVerifyOk: boolean | null;
  lastSmtpVerifyReason: string | null;
  lastTestAt: string | null;
  lastTestAccepted: boolean | null;
  lastTestReason: string | null;
  recommendedHost: 'mail.jalaram.co.ke';
  recommendedPort: 465;
  recommendedTlsMode: 'implicit';
  blockingReasons: string[];
};
