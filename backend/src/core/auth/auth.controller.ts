import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import type { RequestContext } from '../../common/request-context';
import { tenantChannel } from '../../common/tenant-defaults';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  MfaVerifyDto,
  RefreshDto,
  ResetPasswordDto,
} from './auth.dto';
import { Public } from './auth.decorators';
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from './auth-cookies';
import { sessionPolicy } from './session-policy';
import { MfaService } from './mfa.service';

@ApiTags('Auth')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenancyService: TenancyService,
    private readonly mfaService: MfaService,
  ) {}

  @Public()
  @Get('hospitals')
  listHospitals() {
    return this.tenancyService.listPublicHospitals();
  }

  @Public()
  @Get('hospitals/:code')
  getHospital(@Param('code') code: string) {
    return this.tenancyService.getPublicHospital(code);
  }

  @Public()
  @Get('session-policy')
  getSessionPolicy() {
    return sessionPolicy();
  }

  @ApiBearerAuth()
  @Get('me')
  me(@Req() request: RequestContext) {
    return this.authService.getMe(request.user?.sub ?? '');
  }

  @ApiBearerAuth()
  @Post('activity')
  touchActivity(@Req() request: RequestContext) {
    return this.authService.touchActivity(request.user?.sid);
  }

  @Public()
  @Get('mfa/status')
  mfaStatus() {
    return this.mfaService.status();
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      dto.email,
      dto.password,
      dto.device,
      request.ip,
      request.headers['user-agent'] as string | undefined,
      readRefreshToken(request),
      request.tenant?.code,
    );
    setRefreshCookie(response, result.refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = readRefreshToken(request, dto.refreshToken);
    const result = await this.authService.refresh(token ?? '', request.tenant?.code);
    setRefreshCookie(response, result.refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: RequestContext) {
    return this.authService.requestPasswordReset(
      dto.email,
      request.ip,
      tenantChannel(request),
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: RequestContext) {
    return this.authService.resetPassword(
      dto.token,
      dto.newPassword,
      request.ip,
      dto.confirmPassword,
    );
  }

  @Public()
  @Post('logout')
  async logout(
    @Body() dto: LogoutDto,
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(
      readRefreshToken(request, dto.refreshToken),
      request.user?.email,
      request.user?.sub,
      request.ip,
      dto.reason === 'inactivity' ? 'inactivity' : 'user',
    );
    clearRefreshCookie(response);
    return result;
  }

  @ApiBearerAuth()
  @Post('logout-all')
  logoutAll(@Req() request: RequestContext) {
    return this.authService.logoutAll(request.user?.sub ?? '');
  }

  @ApiBearerAuth()
  @Post('change-password')
  async changePassword(
    @Req() request: RequestContext,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changePassword(
      request.user?.sub ?? '',
      dto.currentPassword,
      dto.newPassword,
      'web',
      request.ip,
      request.tenant?.code,
      dto.confirmPassword,
    );
    setRefreshCookie(response, result.refreshToken);
    return result;
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('mfa/challenge')
  issueMfaChallenge(@Req() request: RequestContext) {
    return this.mfaService.issueLoginChallenge({
      userId: request.user?.sub ?? '',
      email: request.user?.email ?? '',
      ip: request.ip,
      purpose: 'step_up',
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mfa/verify')
  async verifyMfa(@Body() dto: MfaVerifyDto, @Req() request: RequestContext) {
    const result = await this.mfaService.verify({
      challengeId: dto.challengeId,
      code: dto.code,
      userId: request.user?.sub,
      ip: request.ip,
    });
    return { verified: true, purpose: result.purpose };
  }
}
