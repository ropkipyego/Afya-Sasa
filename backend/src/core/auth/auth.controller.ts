import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../../common/request-context';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
} from './auth.dto';
import { Public } from './auth.decorators';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: RequestContext) {
    return this.authService.login(
      dto.email,
      dto.password,
      dto.device,
      request.ip,
    );
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
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
    );
  }
}
