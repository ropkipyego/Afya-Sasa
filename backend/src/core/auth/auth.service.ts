import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { RefreshToken, User } from '../core.entities';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async login(email: string, password: string, device?: string, ip?: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.usersService.recordFailedLogin(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.usersService.recordSuccessfulLogin(user);
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

  async logout(rawRefreshToken: string): Promise<{ revoked: boolean }> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokens.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { revoked: true };
  }

  async logoutAll(userId: string): Promise<{ revoked: boolean }> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { revoked: true };
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
