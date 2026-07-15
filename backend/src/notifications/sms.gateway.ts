import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsSendResult {
  provider: string;
  providerMessageId: string | null;
  status: string;
  cost: string | null;
  recipients?: number;
}

export interface SmsGateway {
  sendSms(destination: string, text: string): Promise<SmsSendResult>;
  sendBulkSms?(destinations: string[], text: string): Promise<SmsSendResult>;
}

export const SMS_GATEWAY = Symbol('SMS_GATEWAY');

function normalizeKenyaMobile(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (digits.startsWith('254') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
  return digits;
}

@Injectable()
export class ConfigurableSmsGateway implements SmsGateway {
  constructor(private readonly config: ConfigService) {}

  async sendSms(destination: string, text: string): Promise<SmsSendResult> {
    const provider = this.config.get<string>('SMS_PROVIDER', 'stub');
    if (provider === 'celcom_africa' || provider === 'celcom') {
      return this.sendCelcomAfrica([destination], text);
    }
    if (provider === 'africas_talking') {
      return this.sendAfricasTalking(destination, text);
    }
    if (provider === 'twilio') {
      return this.sendTwilio(destination, text);
    }
    return this.sendStub(destination, text);
  }

  async sendBulkSms(destinations: string[], text: string): Promise<SmsSendResult> {
    const provider = this.config.get<string>('SMS_PROVIDER', 'stub');
    if (provider === 'celcom_africa' || provider === 'celcom') {
      return this.sendCelcomAfrica(destinations, text);
    }
    // Fallback: send one-by-one for other providers
    let last: SmsSendResult = {
      provider,
      providerMessageId: null,
      status: 'queued',
      cost: null,
      recipients: 0,
    };
    for (const destination of destinations) {
      last = await this.sendSms(destination, text);
    }
    return { ...last, recipients: destinations.length };
  }

  private async sendStub(
    destination: string,
    text: string,
  ): Promise<SmsSendResult> {
    const sender = this.config.get<string>('SMS_SENDER_NAME', 'Jalaram');
    return {
      provider: 'stub',
      providerMessageId: `stub-${Date.now()}`,
      status: `queued_by_${sender}_stub_for_${destination}_${text.length}`,
      cost: null,
      recipients: 1,
    };
  }

  /** Celcom Africa ISMS API — https://isms.celcomafrica.com */
  private async sendCelcomAfrica(
    destinations: string[],
    text: string,
  ): Promise<SmsSendResult> {
    const apiKey = this.config.get<string>('CELCOM_API_KEY');
    const partnerId = this.config.get<string>('CELCOM_PARTNER_ID');
    const shortcode = this.config.get<string>(
      'CELCOM_SHORTCODE',
      this.config.get<string>('SMS_SENDER_NAME', 'JALARAM'),
    );
    const endpoint = this.config.get<string>(
      'CELCOM_SMS_URL',
      'https://isms.celcomafrica.com/api/services/sendsms/',
    );

    if (!apiKey || !partnerId) {
      throw new InternalServerErrorException(
        'Celcom Africa SMS credentials are not configured (CELCOM_API_KEY, CELCOM_PARTNER_ID)',
      );
    }

    const mobiles = destinations.map(normalizeKenyaMobile).filter(Boolean);
    if (!mobiles.length) {
      throw new InternalServerErrorException('No valid mobile numbers for Celcom Africa SMS');
    }

    // Celcom accepts comma-separated mobiles for bulk in a single request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        partnerID: partnerId,
        apikey: apiKey,
        mobile: mobiles.join(','),
        message: text,
        shortcode,
        pass_type: 'plain',
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      responses?: Array<{
        'respose-code'?: number;
        'response-code'?: number;
        'response-description'?: string;
        mobile?: string | number;
        messageid?: string | number;
        networkid?: string;
      }>;
      message?: string;
      error?: string;
    };

    const first = payload.responses?.[0];
    const code = first?.['respose-code'] ?? first?.['response-code'];
    if (!response.ok || (code !== undefined && Number(code) !== 200)) {
      throw new InternalServerErrorException(
        first?.['response-description'] ??
          payload.message ??
          payload.error ??
          'Celcom Africa SMS request failed',
      );
    }

    return {
      provider: 'celcom_africa',
      providerMessageId: first?.messageid != null ? String(first.messageid) : null,
      status: first?.['response-description'] ?? 'Success',
      cost: null,
      recipients: mobiles.length,
    };
  }

  private async sendAfricasTalking(
    destination: string,
    text: string,
  ): Promise<SmsSendResult> {
    const username = this.config.get<string>('AFRICAS_TALKING_USERNAME');
    const apiKey = this.config.get<string>('AFRICAS_TALKING_API_KEY');
    const sender = this.config.get<string>('SMS_SENDER_NAME', 'Jalaram');

    if (!username || !apiKey) {
      throw new InternalServerErrorException(
        "Africa's Talking SMS credentials are not configured",
      );
    }

    const params = new URLSearchParams({
      username,
      to: destination,
      message: text,
      from: sender,
    });

    const response = await fetch(
      'https://api.africastalking.com/version1/messaging',
      {
        method: 'POST',
        headers: {
          apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params,
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      SMSMessageData?: {
        Recipients?: Array<{
          messageId?: string;
          status?: string;
          cost?: string;
        }>;
      };
      errorMessage?: string;
    };

    if (!response.ok) {
      throw new InternalServerErrorException(
        payload.errorMessage ?? "Africa's Talking SMS request failed",
      );
    }

    const recipient = payload.SMSMessageData?.Recipients?.[0];
    return {
      provider: 'africas_talking',
      providerMessageId: recipient?.messageId ?? null,
      status: recipient?.status ?? 'queued',
      cost: recipient?.cost ?? null,
      recipients: 1,
    };
  }

  private async sendTwilio(
    destination: string,
    text: string,
  ): Promise<SmsSendResult> {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !from) {
      throw new InternalServerErrorException(
        'Twilio SMS credentials are not configured',
      );
    }

    const params = new URLSearchParams({
      To: destination,
      From: from,
      Body: text,
    });
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
      'base64',
    );

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      sid?: string;
      status?: string;
      price?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new InternalServerErrorException(
        payload.message ?? 'Twilio SMS request failed',
      );
    }

    return {
      provider: 'twilio',
      providerMessageId: payload.sid ?? null,
      status: payload.status ?? 'queued',
      cost: payload.price ?? null,
      recipients: 1,
    };
  }
}
