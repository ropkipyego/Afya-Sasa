import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { TokenRevocationService } from './token-revocation.service';
import {
  generateNumericOtp,
  hashOtp,
  MFA_OTP_TTL_SECONDS,
  otpMatches,
  type MfaChallengeRecord,
} from './mfa-otp';

const GENERIC = 'Verification could not be completed. Request a new code.';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly tokens: TokenRevocationService,
  ) {}

  otpEnabled() {
    return this.config.get<string>('AUTH_MFA_OTP_ENABLED') === 'true';
  }

  otpRequired() {
    return this.otpEnabled() && this.config.get<string>('AUTH_MFA_OTP_REQUIRED') === 'true';
  }

  totpPrepared() {
    return this.config.get<string>('AUTH_MFA_TOTP_ENABLED') === 'true';
  }

  status() {
    return {
      otpEnabled: this.otpEnabled(),
      otpRequired: this.otpRequired(),
      totpEnabled: this.totpPrepared(),
      passkeysEnabled: false,
      rollout: 'disabled',
    };
  }

  async issueLoginChallenge(params: {
    userId: string;
    email: string;
    ip?: string;
    purpose?: MfaChallengeRecord['purpose'];
  }) {
    if (!this.otpEnabled()) {
      throw new ForbiddenException('Verification codes are not enabled');
    }

    const ipLimit = await this.tokens.consumeRateLimit(
      `mfa:issue:ip:${params.ip ?? 'unknown'}`,
      5,
      600,
    );
    const userLimit = await this.tokens.consumeRateLimit(
      `mfa:issue:user:${params.userId}`,
      3,
      600,
    );
    if (!ipLimit.allowed || !userLimit.allowed) {
      throw new ForbiddenException('Too many verification requests. Try again later.');
    }

    const previous = await this.tokens.getEphemeral(this.userPointer(params.userId));
    if (previous) {
      await this.tokens.deleteEphemeral(this.challengeKey(previous));
    }

    const challengeId = randomBytes(18).toString('base64url');
    const code = generateNumericOtp();
    const pepper = this.pepper();
    const record: MfaChallengeRecord = {
      userId: params.userId,
      email: params.email,
      purpose: params.purpose ?? 'login',
      codeHash: hashOtp(code, challengeId, pepper),
      expiresAt: Date.now() + MFA_OTP_TTL_SECONDS * 1000,
      attempts: 0,
    };
    await this.tokens.putEphemeral(
      this.challengeKey(challengeId),
      JSON.stringify(record),
      MFA_OTP_TTL_SECONDS,
    );
    await this.tokens.putEphemeral(
      this.userPointer(params.userId),
      challengeId,
      MFA_OTP_TTL_SECONDS,
    );
    this.logger.log(
      JSON.stringify({
        event: 'mfa_challenge_issued',
        userId: params.userId,
        purpose: record.purpose,
        expiresInSeconds: MFA_OTP_TTL_SECONDS,
      }),
    );
    return {
      challengeId,
      expiresInSeconds: MFA_OTP_TTL_SECONDS,
      delivery: 'suppressed',
      message: 'A verification code would be issued when this factor is approved for rollout.',
    };
  }

  async verify(params: {
    challengeId: string;
    code: string;
    userId?: string;
    ip?: string;
  }): Promise<{ userId: string; email: string; purpose: MfaChallengeRecord['purpose'] }> {
    if (!this.otpEnabled()) {
      throw new ForbiddenException('Verification codes are not enabled');
    }
    const ipLimit = await this.tokens.consumeRateLimit(
      `mfa:verify:ip:${params.ip ?? 'unknown'}`,
      20,
      600,
    );
    if (!ipLimit.allowed) {
      throw new ForbiddenException('Too many verification attempts. Try again later.');
    }

    const raw = await this.tokens.getEphemeral(this.challengeKey(params.challengeId));
    if (!raw) {
      throw new UnauthorizedException(GENERIC);
    }
    const record = JSON.parse(raw) as MfaChallengeRecord;
    if (params.userId && params.userId !== record.userId) {
      throw new UnauthorizedException(GENERIC);
    }
    if (record.expiresAt <= Date.now()) {
      await this.forget(params.challengeId, record.userId);
      throw new UnauthorizedException(GENERIC);
    }
    const challengeLimit = await this.tokens.consumeRateLimit(
      `mfa:verify:challenge:${params.challengeId}`,
      5,
      MFA_OTP_TTL_SECONDS,
    );
    if (!challengeLimit.allowed) {
      await this.forget(params.challengeId, record.userId);
      throw new ForbiddenException('Too many verification attempts. Request a new code.');
    }
    if (!otpMatches(params.code, params.challengeId, this.pepper(), record.codeHash)) {
      throw new UnauthorizedException(GENERIC);
    }
    await this.forget(params.challengeId, record.userId);
    return { userId: record.userId, email: record.email, purpose: record.purpose };
  }

  private async forget(challengeId: string, userId: string) {
    await this.tokens.deleteEphemeral(this.challengeKey(challengeId));
    const pointer = await this.tokens.getEphemeral(this.userPointer(userId));
    if (pointer === challengeId) {
      await this.tokens.deleteEphemeral(this.userPointer(userId));
    }
  }

  private pepper() {
    return (
      this.config.get<string>('AUTH_MFA_OTP_PEPPER') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'local-dev-mfa-pepper'
    );
  }

  private challengeKey(id: string) {
    return `auth:mfa:challenge:${id}`;
  }

  private userPointer(userId: string) {
    return `auth:mfa:user:${userId}`;
  }
}
