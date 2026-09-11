import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type StkResult = {
  checkoutRequestId: string;
  merchantRequestId?: string;
  mock: boolean;
  message: string;
};

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get('MPESA_CONSUMER_KEY') &&
        this.config.get('MPESA_CONSUMER_SECRET') &&
        this.config.get('MPESA_SHORTCODE') &&
        this.config.get('MPESA_PASSKEY'),
    );
  }

  normalizePhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('254')) return digits;
    if (digits.startsWith('0')) return `254${digits.slice(1)}`;
    if (digits.length === 9) return `254${digits}`;
    return digits;
  }

  async initiateStkPush(input: {
    phone: string;
    amount: number;
    accountReference: string;
    description: string;
  }): Promise<StkResult> {
    const phone = this.normalizePhone(input.phone);
    if (!this.isConfigured()) {
      const mockId = `MOCK-${Date.now()}`;
      this.logger.warn(`M-Pesa not configured — mock STK initiated for amount ${input.amount}`);
      return {
        checkoutRequestId: mockId,
        merchantRequestId: mockId,
        mock: true,
        message: 'STK simulated (configure MPESA_* env vars for live Daraja). Approve manually or use sandbox credentials.',
      };
    }

    const token = await this.fetchAccessToken();
    const shortcode = this.config.get<string>('MPESA_SHORTCODE')!;
    const passkey = this.config.get<string>('MPESA_PASSKEY')!;
    const callbackUrl = this.config.get<string>('MPESA_CALLBACK_URL')!;
    const timestamp = this.timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const baseUrl =
      this.config.get('MPESA_ENV') === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(input.amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: input.accountReference.slice(0, 12),
        TransactionDesc: input.description.slice(0, 13),
      }),
    });

    const payload = (await response.json()) as {
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };

    if (!response.ok || !payload.CheckoutRequestID) {
      throw new Error(payload.errorMessage ?? payload.ResponseDescription ?? 'STK push failed');
    }

    return {
      checkoutRequestId: payload.CheckoutRequestID,
      merchantRequestId: payload.MerchantRequestID,
      mock: false,
      message: payload.ResponseDescription ?? 'STK push sent to patient phone',
    };
  }

  parseCallback(body: Record<string, unknown>) {
    const stk = body.Body as { stkCallback?: Record<string, unknown> } | undefined;
    const callback = stk?.stkCallback ?? body;
    const resultCode = Number(callback.ResultCode ?? callback.resultCode ?? -1);
    const checkoutRequestId = String(
      callback.CheckoutRequestID ?? callback.checkoutRequestId ?? '',
    );
    const metadata = (callback.CallbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> })
      ?.Item;
    let mpesaReceiptNumber: string | null = null;
    let amount: number | null = null;
    let phone: string | null = null;
    for (const item of metadata ?? []) {
      if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = String(item.Value);
      if (item.Name === 'Amount') amount = Number(item.Value);
      if (item.Name === 'PhoneNumber') phone = String(item.Value);
    }
    return {
      success: resultCode === 0,
      checkoutRequestId,
      mpesaReceiptNumber,
      amount,
      phone,
      raw: body,
    };
  }

  private async fetchAccessToken() {
    const key = this.config.get<string>('MPESA_CONSUMER_KEY')!;
    const secret = this.config.get<string>('MPESA_CONSUMER_SECRET')!;
    const baseUrl =
      this.config.get('MPESA_ENV') === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const response = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    const payload = (await response.json()) as { access_token?: string; errorMessage?: string };
    if (!response.ok || !payload.access_token) {
      throw new Error(payload.errorMessage ?? 'Failed to obtain M-Pesa access token');
    }
    return payload.access_token;
  }

  private timestamp() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}
