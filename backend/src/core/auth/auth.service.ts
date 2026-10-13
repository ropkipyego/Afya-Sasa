import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { PasswordResetToken, RefreshToken, User } from '../core.entities';
import { UsersService } from '../users/users.service';
import { LoginAuditService } from './login-audit.service';
import { MailService } from '../mail/mail.service';
import { TokenRevocationService } from './token-revocation.service';
import { accessTokenTtlSeconds, refreshTokenTtlMs, sessionPolicy } from './session-policy';
import { defaultTenantCode } from '../../common/tenant-defaults';
import { tenantsEquivalent } from '../../common/tenant-bind';
import { assertPasswordsMatch, validateNewPassword } from './password-policy';
import { parseMailConfig, recipientAllowed } from '../mail/mail.config';

const GENERIC_RESET_MESSAGE =
  'If an account exists for this email, password reset instructions have been sent.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly loginAudit: LoginAuditService,
    private readonly mailService: MailService,
    private readonly tokenRevocation: TokenRevocationService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokens: Repository<PasswordResetToken>,
  ) {}

  async login(
    email: string,
    password: string,
    device?: string,
    ip?: string,
    userAgent?: string,
    incomingRefreshToken?: string,
    tenantCode?: string,
  ) {
    const loginIpLimit = await this.tokenRevocation.consumeRateLimit(
      `login:ip:${ip ?? 'unknown'}`,
      10,
      60,
    );
    const loginEmailLimit = await this.tokenRevocation.consumeRateLimit(
      `login:email:${this.hashToken(email.trim().toLowerCase())}`,
      8,
      60,
    );
    if (!loginIpLimit.allowed || !loginEmailLimit.allowed) {
      await this.loginAudit.record({
        email,
        eventType: 'login_failed',
        success: false,
        failureReason: 'rate_limited',
        ip,
        userAgent,
        device,
      });
      throw new HttpException(
        'Too many sign-in attempts. Please wait and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.usersService.findByEmail(email);

    if (!user || !user.active) {
      await this.loginAudit.record({
        email,
        eventType: 'login_failed',
        success: false,
        failureReason: 'invalid_credentials',
        ip,
        userAgent,
        device,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.loginAudit.record({
        email,
        userId: user.id,
        eventType: 'login_failed',
        success: false,
        failureReason: 'account_locked',
        ip,
        userAgent,
        device,
      });
      throw new UnauthorizedException('Too many failed attempts. Try again later.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.usersService.recordFailedLogin(user);
      await this.loginAudit.record({
        email,
        userId: user.id,
        eventType: 'login_failed',
        success: false,
        failureReason: 'invalid_credentials',
        ip,
        userAgent,
        device,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (incomingRefreshToken) {
      await this.revokeRefreshToken(incomingRefreshToken);
    }

    await this.usersService.recordSuccessfulLogin(user);
    await this.loginAudit.record({
      email,
      userId: user.id,
      eventType: 'login',
      success: true,
      ip,
      userAgent,
      device,
    });

    const auth = await this.usersService.collectRolesAndPermissions(user.id);
    const session = await this.createRefreshToken(user.id, device, ip);
    await this.tokenRevocation.touchSessionActivity(session.id);
    const boundTenant = this.resolvedTenant(tenantCode);
    await this.tokenRevocation.bindSessionTenant(session.id, boundTenant);
    const accessToken = await this.signAccessTokenWithAuth(user, auth, session.id, boundTenant);

    return {
      accessToken,
      refreshToken: session.rawToken,
      tokenType: 'Bearer',
      expiresIn: accessTokenTtlSeconds(),
      user: this.profileFromUser(user, auth),
    };
  }

  async getMe(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.active) {
      throw new UnauthorizedException('User not found');
    }
    return this.toProfile(user);
  }

  async refresh(rawRefreshToken: string, tenantCode?: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const token = await this.refreshTokens.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });

    if (!token || token.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.findOne({ where: { id: token.userId } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (await this.tokenRevocation.isSessionInactive(token.id, token.createdAt.getTime() / 1000)) {
      await this.refreshTokens.update({ id: token.id }, { revokedAt: new Date() });
      await this.tokenRevocation.clearSessionActivity(token.id);
      throw new UnauthorizedException('Session expired due to inactivity');
    }

    const requestTenant = this.resolvedTenant(tenantCode);
    const sessionTenant = await this.tokenRevocation.getSessionTenant(token.id);
    if (sessionTenant && !tenantsEquivalent(sessionTenant, requestTenant)) {
      throw new UnauthorizedException('Tenant context does not match this session');
    }

    await this.refreshTokens.update({ id: token.id }, { revokedAt: new Date() });
    await this.tokenRevocation.clearSessionActivity(token.id);
    const session = await this.createRefreshToken(
      user.id,
      token.device ?? undefined,
      token.ip ?? undefined,
    );
    await this.tokenRevocation.touchSessionActivity(session.id);
    const boundTenant = sessionTenant ?? requestTenant;
    await this.tokenRevocation.bindSessionTenant(session.id, boundTenant);

    const auth = await this.usersService.collectRolesAndPermissions(user.id);

    return {
      accessToken: await this.signAccessTokenWithAuth(user, auth, session.id, boundTenant),
      refreshToken: session.rawToken,
      tokenType: 'Bearer',
      expiresIn: accessTokenTtlSeconds(),
      user: this.profileFromUser(user, auth),
    };
  }

  async logout(
    rawRefreshToken: string | undefined,
    email?: string,
    userId?: string,
    ip?: string,
    reason: 'user' | 'inactivity' = 'user',
  ) {
    if (rawRefreshToken) {
      const existing = await this.refreshTokens.findOne({
        where: { tokenHash: this.hashToken(rawRefreshToken), revokedAt: IsNull() },
      });
      if (existing) {
        await this.refreshTokens.update({ id: existing.id }, { revokedAt: new Date() });
        await this.tokenRevocation.clearSessionActivity(existing.id);
      }
    }
    if (email) {
      await this.loginAudit.record({
        email,
        userId: userId ?? null,
        eventType: reason === 'inactivity' ? 'inactivity_logout' : 'logout',
        success: true,
        ip,
      });
    }
    return { revoked: true };
  }

  async touchActivity(sessionId: string | undefined) {
    if (!sessionId) return { ok: false, ...sessionPolicy() };
    if (await this.tokenRevocation.isSessionInactive(sessionId)) {
      throw new UnauthorizedException('Session expired due to inactivity');
    }
    await this.tokenRevocation.touchSessionActivity(sessionId);
    return { ok: true, ...sessionPolicy() };
  }

  async logoutAll(userId: string): Promise<{ revoked: boolean }> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { revoked: true };
  }

  async requestPasswordReset(email: string, ip?: string, tenantCode = 'demo') {
    const normalized = email.trim().toLowerCase();
    const windowSeconds = Number(this.config.get('PASSWORD_RESET_RATE_WINDOW_SECONDS') ?? 900);
    const limit = Number(this.config.get('PASSWORD_RESET_RATE_LIMIT') ?? 5);
    const ipLimit = await this.tokenRevocation.consumeRateLimit(
      `pwreset:ip:${ip ?? 'unknown'}`,
      limit,
      windowSeconds,
    );
    const emailLimit = await this.tokenRevocation.consumeRateLimit(
      `pwreset:email:${this.hashToken(normalized)}`,
      limit,
      windowSeconds,
    );
    if (!ipLimit.allowed || !emailLimit.allowed) {
      await this.loginAudit.record({
        email: normalized,
        eventType: 'password_reset_requested',
        success: false,
        failureReason: 'rate_limited',
        ip,
      });
      return { message: GENERIC_RESET_MESSAGE };
    }

    const user = await this.usersService.findByEmail(normalized);
    const mail = parseMailConfig();
    const approvedStaff =
      Boolean(user) &&
      user!.active !== false &&
      !(user!.lockedUntil && user!.lockedUntil.getTime() > Date.now()) &&
      (mail.recipientAllowlist.length === 0 || recipientAllowed(mail, user!.email));
    if (user && !approvedStaff) {
      await this.loginAudit.record({
        email: normalized,
        userId: user.id,
        eventType: 'password_reset_requested',
        success: false,
        failureReason: 'not_approved',
        ip,
      });
      return { message: GENERIC_RESET_MESSAGE };
    }
    if (user && approvedStaff) {
      await this.passwordResetTokens.update(
        { userId: user.id, usedAt: IsNull() },
        { usedAt: new Date() },
      );
      const rawToken = randomBytes(32).toString('base64url');
      const ttlMinutes = Number(this.config.get('PASSWORD_RESET_TTL_MINUTES') ?? 30);
      await this.passwordResetTokens.save(
        this.passwordResetTokens.create({
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
          usedAt: null,
        }),
      );
      await this.loginAudit.record({
        email: normalized,
        userId: user.id,
        eventType: 'password_reset_requested',
        success: true,
        ip,
      });
      const mailed = await this.mailService.sendPasswordReset({
        email: user.email,
        resetToken: rawToken,
        tenantCode,
        userId: user.id,
        expiresMinutes: ttlMinutes,
      });
      if (!mailed.accepted) {
        this.logger.warn(`Password reset mail not accepted (${mailed.status})`);
      }
      return { message: GENERIC_RESET_MESSAGE };
    }

    await this.loginAudit.record({
      email: normalized,
      eventType: 'password_reset_requested',
      success: false,
      failureReason: 'email_not_found',
      ip,
    });

    return { message: GENERIC_RESET_MESSAGE };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ip?: string,
    confirmPassword?: string,
  ) {
    const mismatch = assertPasswordsMatch(newPassword, confirmPassword);
    if (mismatch) throw new BadRequestException(mismatch);

    const tokenHash = this.hashToken(token);
    const reset = await this.passwordResetTokens.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });
    if (!reset || reset.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.users.findOne({ where: { id: reset.userId } });
    if (!user) throw new NotFoundException('User not found');

    const policyError = validateNewPassword(newPassword, { email: user.email });
    if (policyError) throw new BadRequestException(policyError);

    await this.users.update(user.id, {
      passwordHash: await bcrypt.hash(newPassword, 12),
      forcePasswordChange: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await this.passwordResetTokens.update(reset.id, { usedAt: new Date() });
    await this.passwordResetTokens.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    await this.tokenRevocation.invalidateUser(user.id);
    await this.logoutAll(user.id);
    await this.loginAudit.record({
      email: user.email,
      userId: user.id,
      eventType: 'password_reset_completed',
      success: true,
      ip,
    });
    await this.mailService.sendPasswordChanged(user.email, user.id);

    return { message: 'Password updated successfully. Sign in with your new password.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    device?: string,
    ip?: string,
    tenantCode?: string,
    confirmPassword?: string,
  ) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const mismatch = assertPasswordsMatch(newPassword, confirmPassword);
    if (mismatch) throw new BadRequestException(mismatch);
    const policyError = validateNewPassword(newPassword, {
      email: user.email,
      currentPassword,
    });
    if (policyError) throw new BadRequestException(policyError);

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new BadRequestException('Current password is incorrect');
    }

    await this.users.update(userId, {
      passwordHash: await bcrypt.hash(newPassword, 12),
      forcePasswordChange: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await this.tokenRevocation.invalidateUser(userId);
    await this.logoutAll(userId);
    await this.loginAudit.record({
      email: user.email,
      userId,
      eventType: 'password_changed',
      success: true,
      ip,
      device,
    });
    await this.mailService.sendPasswordChanged(user.email, userId);

    const updated = await this.users.findOneOrFail({ where: { id: userId } });
    const auth = await this.usersService.collectRolesAndPermissions(updated.id);
    const session = await this.createRefreshToken(userId, device, ip);
    await this.tokenRevocation.touchSessionActivity(session.id);
    const boundTenant = this.resolvedTenant(tenantCode);
    await this.tokenRevocation.bindSessionTenant(session.id, boundTenant);
    const accessToken = await this.signAccessTokenWithAuth(updated, auth, session.id, boundTenant);

    return {
      changed: true,
      accessToken,
      refreshToken: session.rawToken,
      user: this.profileFromUser(updated, auth),
    };
  }

  private profileFromUser(
    user: User,
    auth: { roles: string[]; permissions: string[] },
  ) {
    return {
      id: user.id,
      employeeNo: user.employeeNo,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: auth.roles,
      permissions: auth.permissions,
      forcePasswordChange: user.forcePasswordChange,
    };
  }

  private resolvedTenant(tenantCode?: string) {
    return tenantCode?.trim() || defaultTenantCode();
  }

  private async signAccessTokenWithAuth(
    user: User,
    auth: { roles: string[]; permissions: string[] },
    sessionId: string,
    tenantCode: string,
  ): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      roles: auth.roles,
      permissions: auth.permissions,
      forcePasswordChange: user.forcePasswordChange,
      sid: sessionId,
      tid: this.resolvedTenant(tenantCode),
    });
  }

  private async createRefreshToken(
    userId: string,
    device?: string,
    ip?: string,
  ): Promise<{ rawToken: string; id: string }> {
    const rawToken = randomBytes(48).toString('base64url');
    const token = this.refreshTokens.create({
      userId,
      tokenHash: this.hashToken(rawToken),
      device: device ?? null,
      ip: ip ?? null,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
      revokedAt: null,
    });

    const saved = await this.refreshTokens.save(token);
    return { rawToken, id: saved.id };
  }

  private async revokeRefreshToken(rawToken: string) {
    const existing = await this.refreshTokens.findOne({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: IsNull() },
    });
    if (!existing) return;
    await this.refreshTokens.update({ id: existing.id }, { revokedAt: new Date() });
    await this.tokenRevocation.clearSessionActivity(existing.id);
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async toProfile(user: User) {
    const auth = await this.usersService.collectRolesAndPermissions(user.id);
    return this.profileFromUser(user, auth);
  }
}
