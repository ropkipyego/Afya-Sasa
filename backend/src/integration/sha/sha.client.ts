import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ShaIdentificationType } from './sha.types';

type TokenCache = { accessToken: string; expiresAt: number };

export type ShaEligibilityApiResponse = {
  requestIdNumber?: string;
  requestIdType?: number | string;
  age?: number;
  dateOfBirth?: string;
  facilityBiometricsEnforced?: boolean;
  fullName?: string;
  gender?: string;
  isAlive?: boolean;
  memberCrNumber?: string;
  schemes?: Array<{
    schemeName?: string;
    status?: string;
    fund?: string;
    validFrom?: string;
    validTo?: string;
  }>;
  statusCode?: string;
  statusDesc?: string;
  whitelistedForOTP?: boolean;
};

@Injectable()
export class ShaClient {
  private readonly logger = new Logger(ShaClient.name);
  private token: TokenCache | null = null;

  constructor(private readonly config: ConfigService) {}

  get baseUrl() {
    return (
      this.config.get<string>('SHA_HIE_BASE_URL') ||
      'https://ilm-dev.dha.go.ke/uat-middleware/api/v1'
    ).replace(/\/$/, '');
  }

  get facilityFrCode() {
    return this.config.get<string>('SHA_FACILITY_FR_CODE')?.trim() || '';
  }

  get clientId() {
    return this.config.get<string>('SHA_CLIENT_ID')?.trim() || '';
  }

  get clientSecret() {
    return this.config.get<string>('SHA_CLIENT_SECRET')?.trim() || '';
  }

  credentialsReady() {
    return Boolean(this.clientId && this.clientSecret && this.facilityFrCode);
  }

  async checkEligibility(identificationType: ShaIdentificationType, identificationNumber: string) {
    const token = await this.getAccessToken();
    const url = new URL(`${this.baseUrl}/patients/eligibility`);
    url.searchParams.set('identification_type', identificationType);
    url.searchParams.set('identification_number', identificationNumber);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Facility-Id': this.facilityFrCode,
        'X-Facility-Id-Type': 'fr-code',
        Accept: 'application/json',
      },
    });
    const body = (await response.json().catch(() => ({}))) as ShaEligibilityApiResponse & {
      message?: string;
      error?: string;
    };
    if (!response.ok) {
      const message = body.message || body.error || `SHA eligibility failed (${response.status})`;
      this.logger.warn(message);
      throw new Error(message);
    }
    return body;
  }

  private async getAccessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 15_000) {
      return this.token.accessToken;
    }
    const response = await fetch(`${this.baseUrl}/tenants/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      accessToken?: string;
      expires_in?: number;
      message?: string;
    };
    const accessToken = body.access_token || body.accessToken;
    if (!response.ok || !accessToken) {
      throw new Error(body.message || 'SHA HIE token request failed');
    }
    this.token = {
      accessToken,
      expiresAt: Date.now() + (Number(body.expires_in ?? 300) * 1000),
    };
    return accessToken;
  }
}
