import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { EmailDelivery } from './mail.entities';
import {
  assertTrustedResetOrigin,
  MailConfigurationError,
  mailReadyToSend,
  mergeMailConfig,
  nodemailerTransportOptions,
  parseMailConfig,
  purposeAllowed,
  recipientAllowed,
} from './mail.config';
import { APPROVED_SENDER, isValidEmailAddress, senderIsApproved } from './mail.policy';
import { MailOverlayStore } from './mail.overlay';
import { emailDomain, emailFingerprint, redactSecrets } from './mail.redact';
import {
  governmentNotificationTemplate,
  internalReportTemplate,
  passwordChangedTemplate,
  passwordResetTemplate,
  systemAlertTemplate,
} from './mail.templates';
import type {
  MailDiagnostics,
  MailRuntimeConfig,
  MailSendRequest,
  MailSendResult,
  MailTransportStatus,
} from './mail.types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private lastStatus: MailTransportStatus = 'NOT_CONFIGURED';
  private lastAcceptedAt: Date | null = null;
  private lastFailureReason: string | null = null;
  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  createTransport = (options: ReturnType<typeof nodemailerTransportOptions>) =>
    nodemailer.createTransport(options as Parameters<typeof nodemailer.createTransport>[0]);

  constructor(
    @InjectRepository(EmailDelivery)
    private readonly deliveries: Repository<EmailDelivery>,
    @Optional() private readonly overlayStore?: MailOverlayStore,
  ) {}

  runtimeConfig(env: NodeJS.ProcessEnv = process.env): MailRuntimeConfig {
    const parsed = parseMailConfig(env);
    if (!this.overlayStore || env !== process.env) return parsed;
    return mergeMailConfig(parsed, this.overlayStore.snapshot());
  }

  diagnostics(env: NodeJS.ProcessEnv = process.env): MailDiagnostics {
    const envConfig = parseMailConfig(env);
    const overlay = this.overlayStore?.snapshot();
    const config = this.runtimeConfig(env);
    const ready = mailReadyToSend(config);
    const configurationComplete = Boolean(
      envConfig.host && envConfig.username && envConfig.password && senderIsApproved(envConfig.fromAddress),
    );
    let status: MailTransportStatus = this.lastStatus;
    if (!ready.ok) status = 'NOT_CONFIGURED';
    return {
      status,
      deliveryEnabled: config.deliveryEnabled,
      deploymentDeliveryEnabled: envConfig.deliveryEnabled,
      operatorDeliveryRequested: overlay?.operatorDeliveryRequested ?? false,
      configurationComplete,
      smtpVerified: overlay?.lastSmtpVerifyOk === true,
      smtpAccepted: Boolean(this.lastAcceptedAt),
      recipientDelivered: false,
      smtpHostConfigured: Boolean(config.host),
      smtpHost: config.host,
      smtpPort: config.port,
      tlsMode: config.tlsMode,
      tlsCertificateVerification: true,
      smtpAuthConfigured: Boolean(config.username && config.password),
      fromAddress: config.fromAddress,
      approvedSender: APPROVED_SENDER,
      senderApproved: senderIsApproved(config.fromAddress),
      publicOriginConfigured: Boolean(config.publicOrigin),
      publicOriginUsesHttps: Boolean(config.publicOrigin?.startsWith('https://')),
      lastAcceptedAt: this.lastAcceptedAt?.toISOString() ?? null,
      lastFailureReason: this.lastFailureReason,
      recipientAllowlistConfigured: config.recipientAllowlist.length > 0,
      recipientAllowlist: config.recipientAllowlist,
      allowUnrestrictedRecipients: config.allowUnrestrictedRecipients,
      policies: config.policies,
      lastSmtpVerifyAt: overlay?.lastSmtpVerifyAt ?? null,
      lastSmtpVerifyOk: overlay?.lastSmtpVerifyOk ?? null,
      lastSmtpVerifyReason: overlay?.lastSmtpVerifyReason ?? null,
      lastTestAt: overlay?.lastTestAt ?? null,
      lastTestAccepted: overlay?.lastTestAccepted ?? null,
      lastTestReason: overlay?.lastTestReason ?? null,
      recommendedHost: 'mail.jalaram.co.ke',
      recommendedPort: 465,
      recommendedTlsMode: 'implicit',
    };
  }

  buildPasswordResetUrl(rawToken: string, tenantCode: string, env: NodeJS.ProcessEnv = process.env): string {
    const origin = assertTrustedResetOrigin(this.runtimeConfig(env));
    const url = new URL(origin);
    url.searchParams.set('resetToken', rawToken);
    url.searchParams.set('tenant', tenantCode);
    return url.toString();
  }

  async sendPasswordReset(input: {
    email: string;
    resetToken: string;
    tenantCode: string;
    userId?: string;
    expiresMinutes: number;
  }): Promise<MailSendResult> {
    let resetUrl: string;
    try {
      resetUrl = this.buildPasswordResetUrl(input.resetToken, input.tenantCode);
    } catch (error) {
      const reason =
        error instanceof Error ? redactSecrets(error.message) : 'reset origin is not configured';
      this.lastStatus = 'NOT_CONFIGURED';
      this.lastFailureReason = reason;
      this.logger.warn(`Password reset email skipped: ${reason}`);
      return {
        accepted: false,
        status: 'NOT_CONFIGURED',
        attempts: 0,
        duplicate: false,
        reason,
      };
    }
    const template = passwordResetTemplate(resetUrl, input.expiresMinutes);
    return this.send({
      to: input.email,
      purpose: 'password_reset',
      subject: template.subject,
      text: template.text,
      html: template.html,
      idempotencyKey: `password_reset:${input.userId ?? input.email}:${this.tokenFingerprint(input.resetToken)}`,
      createdBy: input.userId ?? null,
    });
  }

  async sendPasswordChanged(email: string, userId?: string): Promise<MailSendResult> {
    const template = passwordChangedTemplate();
    return this.send({
      to: email,
      purpose: 'password_changed',
      subject: template.subject,
      text: template.text,
      html: template.html,
      idempotencyKey: `password_changed:${userId ?? email}:${Date.now()}`,
      createdBy: userId ?? null,
    });
  }

  async sendInternalReportNotice(input: {
    to: string;
    reportType: string;
    rangeLabel: string;
    viewUrl: string;
    requesterEmail: string;
    idempotencyKey: string;
    createdBy?: string | null;
  }): Promise<MailSendResult> {
    const template = internalReportTemplate(input);
    return this.send({
      to: input.to,
      purpose: 'internal_report',
      subject: template.subject,
      text: template.text,
      html: template.html,
      idempotencyKey: input.idempotencyKey,
      createdBy: input.createdBy ?? null,
    });
  }

  async sendSystemAlert(input: {
    to: string;
    title: string;
    detail: string;
    idempotencyKey: string;
  }): Promise<MailSendResult> {
    const template = systemAlertTemplate(input);
    return this.send({
      to: input.to,
      purpose: 'system_alert',
      subject: template.subject,
      text: template.text,
      html: template.html,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async sendGovernmentNotification(input: {
    to: string;
    kind: 'failure' | 'acknowledgement';
    integration: string;
    detail: string;
    idempotencyKey: string;
  }): Promise<MailSendResult> {
    const template = governmentNotificationTemplate(input);
    return this.send({
      to: input.to,
      purpose: 'government_notification',
      subject: template.subject,
      text: template.text,
      html: template.html,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async verifyConnection(env: NodeJS.ProcessEnv = process.env): Promise<{
    ok: boolean;
    reason: string;
    verifiedAt: string;
  }> {
    const config = this.runtimeConfig(env);
    const verifiedAt = new Date().toISOString();
    if (!config.host || !config.username || !config.password) {
      const reason = 'SMTP host or credentials are not configured';
      this.recordVerify(false, reason, verifiedAt);
      return { ok: false, reason, verifiedAt };
    }
    try {
      const transporter = this.createTransport(nodemailerTransportOptions(config));
      const verified = await Promise.race([
        transporter.verify(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('SMTP verification timed out')), config.connectionTimeoutMs),
        ),
      ]);
      const ok = verified === true;
      const reason = ok
        ? 'SMTP accepted a connection. This is not proof that a recipient mailbox received mail.'
        : 'SMTP did not confirm the connection';
      this.recordVerify(ok, reason, verifiedAt);
      return { ok, reason, verifiedAt };
    } catch (error) {
      const reason = this.safeError(error, [config.password, config.username]);
      this.recordVerify(false, reason, verifiedAt);
      return { ok: false, reason, verifiedAt };
    }
  }

  async sendAdministratorTest(to: string, actorId: string | null, env: NodeJS.ProcessEnv = process.env) {
    const config = this.runtimeConfig(env);
    if (!isValidEmailAddress(to)) {
      return {
        accepted: false,
        status: 'NOT_CONFIGURED' as const,
        attempts: 0,
        duplicate: false,
        reason: 'Recipient address is invalid',
      };
    }
    if (!recipientAllowed(config, to)) {
      return {
        accepted: false,
        status: 'NOT_CONFIGURED' as const,
        attempts: 0,
        duplicate: false,
        reason: 'Recipient is not on EMAIL_RECIPIENT_ALLOWLIST',
      };
    }
    const result = await this.send(
      {
        to,
        purpose: 'system_alert',
        subject: 'Jalaram Hospital: SMTP test',
        text: 'This is a Control Center SMTP test. Acceptance by the mail server is not proof of mailbox delivery.',
        html: '<p>This is a Control Center SMTP test. Acceptance by the mail server is not proof of mailbox delivery.</p>',
        idempotencyKey: `smtp_test:${actorId ?? 'admin'}:${Date.now()}`,
        createdBy: actorId,
      },
      env,
    );
    this.overlayStore?.replace({
      ...this.overlayStore.snapshot(),
      lastTestAt: new Date().toISOString(),
      lastTestAccepted: result.accepted,
      lastTestReason: result.accepted
        ? 'SMTP accepted the test message. Recipient delivery is not confirmed.'
        : result.reason ?? result.status,
    });
    return result;
  }

  async send(request: MailSendRequest, env: NodeJS.ProcessEnv = process.env): Promise<MailSendResult> {
    const config = this.runtimeConfig(env);
    if (!isValidEmailAddress(request.to)) {
      return {
        accepted: false,
        status: 'NOT_CONFIGURED',
        attempts: 0,
        duplicate: false,
        reason: 'Recipient address is invalid',
      };
    }
    if (!purposeAllowed(config, request.purpose)) {
      return {
        accepted: false,
        status: 'NOT_CONFIGURED',
        attempts: 0,
        duplicate: false,
        reason: `Email policy disables ${request.purpose}`,
      };
    }
    const existing = await this.findByIdempotency(request.idempotencyKey);
    if (existing?.acceptedAt) {
      return {
        accepted: true,
        status: 'READY',
        deliveryId: existing.id,
        providerMessageId: existing.providerMessageId,
        attempts: existing.attempts,
        duplicate: true,
      };
    }

    if (!recipientAllowed(config, request.to)) {
      this.lastStatus = 'NOT_CONFIGURED';
      this.logger.warn(`Email not sent (${request.purpose}): recipient is not on EMAIL_RECIPIENT_ALLOWLIST`);
      return {
        accepted: false,
        status: 'NOT_CONFIGURED',
        attempts: 0,
        duplicate: false,
        reason: 'recipient is not on EMAIL_RECIPIENT_ALLOWLIST',
      };
    }

    const ready = mailReadyToSend(config);
    if (!ready.ok) {
      this.lastStatus = 'NOT_CONFIGURED';
      const saved = await this.persist(request, {
        status: 'NOT_CONFIGURED',
        attempts: 0,
        lastErrorSafe: ready.reason,
      });
      this.logger.warn(`Email not sent (${request.purpose}): ${ready.reason}`);
      return {
        accepted: false,
        status: 'NOT_CONFIGURED',
        deliveryId: saved?.id,
        attempts: 0,
        duplicate: false,
        reason: ready.reason,
      };
    }

    const secrets = [config.password, config.username];
    let lastError = 'SMTP send failed';
    let attempts = existing?.attempts ?? 0;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
      attempts = (existing?.attempts ?? 0) + attempt;
      try {
        const info = await this.dispatch(config, request);
        const acceptedRecipients = Array.isArray(info.accepted) ? info.accepted : [];
        const rejectedRecipients = Array.isArray(info.rejected) ? info.rejected : [];
        if (!acceptedRecipients.length || rejectedRecipients.length) {
          throw new Error('SMTP provider did not accept the message');
        }
        this.lastStatus = 'READY';
        this.lastAcceptedAt = new Date();
        this.lastFailureReason = null;
        const saved = await this.persist(request, {
          status: 'ACCEPTED',
          attempts,
          providerMessageId: typeof info.messageId === 'string' ? info.messageId : null,
          acceptedAt: this.lastAcceptedAt,
          lastErrorSafe: null,
          id: existing?.id,
        });
        this.logger.log(`Email accepted (${request.purpose}) delivery=${saved?.id ?? 'n/a'}`);
        return {
          accepted: true,
          status: 'READY',
          deliveryId: saved?.id,
          providerMessageId: typeof info.messageId === 'string' ? info.messageId : null,
          attempts,
          duplicate: false,
        };
      } catch (error) {
        lastError = this.safeError(error, secrets);
        this.lastFailureReason = lastError;
        this.lastStatus = attempt < config.maxAttempts ? 'DEGRADED' : 'FAILED';
        this.logger.error(`Email ${this.lastStatus} (${request.purpose}) attempt=${attempt}: ${lastError}`);
        if (attempt < config.maxAttempts) {
          await this.sleep(200 * 2 ** (attempt - 1));
        }
      }
    }

    const saved = await this.persist(request, {
      status: 'FAILED',
      attempts,
      lastErrorSafe: lastError,
      id: existing?.id,
    });
    return {
      accepted: false,
      status: 'FAILED',
      deliveryId: saved?.id,
      attempts,
      duplicate: false,
      reason: lastError,
    };
  }

  private async dispatch(config: MailRuntimeConfig, request: MailSendRequest) {
    const options = nodemailerTransportOptions(config);
    if (options.tls.rejectUnauthorized !== true) {
      throw new MailConfigurationError('Refusing to send without TLS certificate verification');
    }
    const transporter = this.getTransporter(config);
    return transporter.sendMail({
      from: `${config.fromName} <${config.fromAddress}>`,
      to: request.to,
      subject: request.subject,
      text: request.text,
      html: request.html,
    });
  }

  private getTransporter(config: MailRuntimeConfig): Transporter {
    if (!this.transporter) {
      this.transporter = this.createTransport(nodemailerTransportOptions(config));
    }
    return this.transporter;
  }

  private async findByIdempotency(key: string): Promise<EmailDelivery | null> {
    if (!this.deliveries?.findOne) return null;
    return this.deliveries.findOne({ where: { idempotencyKey: key } });
  }

  private async persist(
    request: MailSendRequest,
    patch: Partial<EmailDelivery> & { id?: string },
  ): Promise<EmailDelivery | null> {
    if (!this.deliveries?.create) return null;
    const data = {
      idempotencyKey: request.idempotencyKey,
      purpose: request.purpose,
      recipientFingerprint: this.hashValue(emailFingerprint(request.to)),
      recipientDomain: emailDomain(request.to),
      subject: request.subject.slice(0, 180),
      status: patch.status ?? 'QUEUED',
      attempts: patch.attempts ?? 0,
      lastErrorSafe: patch.lastErrorSafe ?? null,
      providerMessageId: patch.providerMessageId ?? null,
      acceptedAt: patch.acceptedAt ?? null,
      createdBy: request.createdBy ?? null,
    };
    try {
      if (patch.id && this.deliveries.update) {
        await this.deliveries.update(patch.id, data);
        return this.deliveries.findOne({ where: { id: patch.id } });
      }
      const row = this.deliveries.create(data);
      if (this.deliveries.save) {
        return this.deliveries.save(row);
      }
      return row;
    } catch (error) {
      this.logger.warn(
        `Email delivery row not persisted: ${this.safeError(error, [])}`,
      );
      return null;
    }
  }

  private safeError(error: unknown, secrets: Array<string | null | undefined>): string {
    const message = error instanceof Error ? error.message : String(error);
    return redactSecrets(message, secrets);
  }

  private recordVerify(ok: boolean, reason: string, verifiedAt: string) {
    this.lastStatus = ok ? 'READY' : 'FAILED';
    this.lastFailureReason = ok ? null : reason;
    this.overlayStore?.replace({
      ...this.overlayStore.snapshot(),
      lastSmtpVerifyAt: verifiedAt,
      lastSmtpVerifyOk: ok,
      lastSmtpVerifyReason: reason,
    });
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private tokenFingerprint(token: string): string {
    return this.hashValue(token).slice(0, 16);
  }
}
