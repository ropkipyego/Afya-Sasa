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

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly loginAudit: LoginAuditService,
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

    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id, device, ip);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 15 * 60,
      user: await this.toProfile(user),
    };
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

    return {
      accessToken: await this.signAccessToken(user),
      tokenType: 'Bearer',
      expiresIn: 15 * 60,
    };
  }

  async logout(rawRefreshToken: string, email?: string, userId?: string, ip?: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokens.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (email) {
      await this.loginAudit.record({
        email,
        userId: userId ?? null,
        eventType: 'logout',
        success: true,
        ip,
      });
    }
    return { revoked: true };
  }

  async logoutAll(userId: string): Promise<{ revoked: boolean }> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { revoked: true };
  }

  async requestPasswordReset(email: string, ip?: string) {
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
      return {
        message:
          'If an account exists for this email, password reset instructions have been sent.',
        // Dev-only helper — remove or gate behind NODE_ENV in production email flow
        resetToken: process.env.NODE_ENV === 'production' ? undefined : rawToken,
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
  ): Promise<{ changed: boolean }> {
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
    await this.logoutAll(userId);

    return { changed: true };
  }

  private async signAccessToken(user: User): Promise<string> {
    const { roles, permissions } =
      await this.usersService.collectRolesAndPermissions(user.id);

    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      forcePasswordChange: user.forcePasswordChange,
    });
  }

  private async createRefreshToken(
    userId: string,
    device?: string,
    ip?: string,
  ): Promise<string> {
    const rawToken = randomBytes(48).toString('base64url');
    const token = this.refreshTokens.create({
      userId,
      tokenHash: this.hashToken(rawToken),
      device: device ?? null,
      ip: ip ?? null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    });

    await this.refreshTokens.save(token);
    return rawToken;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async toProfile(user: User) {
    const { roles, permissions } =
      await this.usersService.collectRolesAndPermissions(user.id);

    return {
      id: user.id,
      employeeNo: user.employeeNo,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles,
      permissions,
      forcePasswordChange: user.forcePasswordChange,
    };
  }
}
