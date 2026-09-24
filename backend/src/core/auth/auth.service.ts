import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
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
  ) {
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
      throw new UnauthorizedException('Account is temporarily locked');
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
    const accessToken = await this.signAccessTokenWithAuth(user, auth, session.id);

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

  async refresh(rawRefreshToken: string) {
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

    await this.refreshTokens.update({ id: token.id }, { revokedAt: new Date() });
    await this.tokenRevocation.clearSessionActivity(token.id);
    const session = await this.createRefreshToken(
      user.id,
      token.device ?? undefined,
      token.ip ?? undefined,
    );
    await this.tokenRevocation.touchSessionActivity(session.id);

    const auth = await this.usersService.collectRolesAndPermissions(user.id);

    return {
      accessToken: await this.signAccessTokenWithAuth(user, auth, session.id),
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
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const rawToken = randomBytes(32).toString('base64url');
      await this.passwordResetTokens.save(
        this.passwordResetTokens.create({
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          usedAt: null,
        }),
      );
      await this.loginAudit.record({
        email,
        userId: user.id,
        eventType: 'password_reset_requested',
        success: true,
        ip,
      });
      const emailed = await this.mailService.sendPasswordReset({
        email: user.email,
        resetToken: rawToken,
        tenantCode,
      });
      return {
        message:
          'If an account exists for this email, password reset instructions have been sent.',
        resetToken:
          !emailed && process.env.NODE_ENV !== 'production' ? rawToken : undefined,
      };
    }

    await this.loginAudit.record({
      email,
      eventType: 'password_reset_requested',
      success: false,
      failureReason: 'email_not_found',
      ip,
    });

    return {
      message:
        'If an account exists for this email, password reset instructions have been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string, ip?: string) {
    const tokenHash = this.hashToken(token);
    const reset = await this.passwordResetTokens.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });
    if (!reset || reset.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.users.findOne({ where: { id: reset.userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.users.update(user.id, {
      passwordHash: await bcrypt.hash(newPassword, 12),
      forcePasswordChange: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await this.passwordResetTokens.update(reset.id, { usedAt: new Date() });
    await this.tokenRevocation.invalidateUser(user.id);
    await this.logoutAll(user.id);
    await this.loginAudit.record({
      email: user.email,
      userId: user.id,
      eventType: 'password_reset_completed',
      success: true,
      ip,
    });

    return { message: 'Password updated successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    device?: string,
    ip?: string,
  ) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

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
    });
    await this.tokenRevocation.invalidateUser(userId);
    await this.logoutAll(userId);

    const updated = await this.users.findOneOrFail({ where: { id: userId } });
    const auth = await this.usersService.collectRolesAndPermissions(updated.id);
    const session = await this.createRefreshToken(userId, device, ip);
    await this.tokenRevocation.touchSessionActivity(session.id);
    const accessToken = await this.signAccessTokenWithAuth(updated, auth, session.id);

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

  private async signAccessTokenWithAuth(
    user: User,
    auth: { roles: string[]; permissions: string[] },
    sessionId: string,
  ): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      roles: auth.roles,
      permissions: auth.permissions,
      forcePasswordChange: user.forcePasswordChange,
      sid: sessionId,
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
