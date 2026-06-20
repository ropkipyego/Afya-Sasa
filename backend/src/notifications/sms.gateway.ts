import { Injectable } from '@nestjs/common';
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

@Injectable()
export class StubSmsGateway implements SmsGateway {
  constructor(private readonly config: ConfigService) {}

  async sendSms(destination: string, text: string): Promise<SmsSendResult> {
    const sender = this.config.get<string>('SMS_SENDER_NAME', 'AfyaSasa');
    return {
      provider: 'stub',
      providerMessageId: `stub-${Date.now()}`,
      status: `queued_by_${sender}_stub_for_${destination}_${text.length}`,
      cost: null,
    };
  }
}
