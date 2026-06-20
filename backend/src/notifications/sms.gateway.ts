import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsSendResult {
  provider: string;
  providerMessageId: string | null;
  status: string;
  cost: string | null;
}

export interface SmsGateway {
  sendSms(destination: string, text: string): Promise<SmsSendResult>;
}

export const SMS_GATEWAY = Symbol('SMS_GATEWAY');

@Injectable()
export class ConfigurableSmsGateway implements SmsGateway {
  constructor(private readonly config: ConfigService) {}

  async sendSms(destination: string, text: string): Promise<SmsSendResult> {
    const provider = this.config.get<string>('SMS_PROVIDER', 'stub');
    if (provider === 'africas_talking') {
      return this.sendAfricasTalking(destination, text);
    }
    if (provider === 'twilio') {
      return this.sendTwilio(destination, text);
    }
    return this.sendStub(destination, text);
  }

  private async sendStub(
    destination: string,
    text: string,
  ): Promise<SmsSendResult> {
    const sender = this.config.get<string>('SMS_SENDER_NAME', 'AfyaSasa');
    return {
      provider: 'stub',
      providerMessageId: `stub-${Date.now()}`,
      status: `queued_by_${sender}_stub_for_${destination}_${text.length}`,
      cost: null,
    };
  }

  private async sendAfricasTalking(
    destination: string,
    text: string,
  ): Promise<SmsSendResult> {
    const username = this.config.get<string>('AFRICAS_TALKING_USERNAME');
    const apiKey = this.config.get<string>('AFRICAS_TALKING_API_KEY');
    const sender = this.config.get<string>('SMS_SENDER_NAME', 'AfyaSasa');

    if (!username || !apiKey) {
      throw new InternalServerErrorException(
        'Africa’s Talking SMS credentials are not configured',
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
        payload.errorMessage ?? 'Africa’s Talking SMS request failed',
      );
    }

    const recipient = payload.SMSMessageData?.Recipients?.[0];
    return {
      provider: 'africas_talking',
      providerMessageId: recipient?.messageId ?? null,
      status: recipient?.status ?? 'queued',
      cost: recipient?.cost ?? null,
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
    };
  }
}
