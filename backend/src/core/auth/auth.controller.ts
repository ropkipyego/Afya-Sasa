import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { RequestContext } from '../../common/request-context';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  ResetPasswordDto,
} from './auth.dto';
import { Public } from './auth.decorators';

@ApiTags('Auth')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiBearerAuth()
  @Get('me')
  me(@Req() request: RequestContext) {
    return this.authService.getMe(request.user?.sub ?? '');
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: RequestContext) {
    return this.authService.login(
      dto.email,
      dto.password,
      dto.device,
      request.ip,
      request.headers['user-agent'] as string | undefined,
    );
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: RequestContext) {
    return this.authService.requestPasswordReset(
      dto.email,
      request.ip,
      request.tenant?.code ?? 'demo',
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: RequestContext) {
    return this.authService.resetPassword(dto.token, dto.newPassword, request.ip);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(@Body() dto: LogoutDto, @Req() request: RequestContext) {
    return this.authService.logout(
      dto.refreshToken,
      request.user?.email,
      request.user?.sub,
      request.ip,
    );
  }

  @ApiBearerAuth()
  @Post('logout-all')
  logoutAll(@Req() request: RequestContext) {
    return this.authService.logoutAll(request.user?.sub ?? '');
  }

  @ApiBearerAuth()
  @Post('change-password')
  changePassword(
    @Req() request: RequestContext,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      request.user?.sub ?? '',
      dto.currentPassword,
      dto.newPassword,
      'web',
      request.ip,
    );
  }
}
