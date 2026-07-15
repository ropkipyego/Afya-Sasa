import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('SMTP_HOST');
    if (!host?.trim()) {
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASSWORD'),
      },
    });

    return this.transporter;
  }

  async sendPasswordReset(input: {
    email: string;
    resetToken: string;
    tenantCode: string;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    const from = this.config.get<string>('SMTP_FROM', 'noreply@afyasasa.local');
    const appUrl = this.config.get<string>('APP_PUBLIC_URL', 'http://localhost:8080');
    const resetUrl = `${appUrl.replace(/\/$/, '')}/?resetToken=${encodeURIComponent(input.resetToken)}&tenant=${encodeURIComponent(input.tenantCode)}`;

    const subject = 'AfyaSasa password reset';
    const text = [
      'You requested a password reset for your AfyaSasa account.',
      '',
      `Open this link within 1 hour: ${resetUrl}`,
      '',
      'If you did not request this, ignore this email.',
    ].join('\n');

    if (!transporter) {
      this.logger.warn(
        `SMTP not configured — password reset for ${input.email} (token logged in dev only)`,
      );
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        this.logger.log(`Dev reset URL: ${resetUrl}`);
      }
      return false;
    }

    await transporter.sendMail({
      from,
      to: input.email,
      subject,
      text,
      html: `<p>You requested a password reset for AfyaSasa.</p><p><a href="${resetUrl}">Reset your password</a> (expires in 1 hour).</p><p>If you did not request this, ignore this email.</p>`,
    });

    return true;
  }
}
