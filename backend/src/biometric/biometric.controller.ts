import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { RequestContext } from '../common/request-context';
import { Public, RequirePermissions } from '../core/auth/auth.decorators';
import { BiometricService } from './biometric.service';
import {
  DeviceHeartbeatDto,
  EnrollBiometricDto,
  IdentifyBiometricDto,
  RegisterBiometricDeviceDto,
  VerifyBiometricDto,
} from './biometric.dto';

@ApiBearerAuth()
@ApiTags('Biometrics')
@Controller('biometrics')
export class BiometricController {
  constructor(private readonly biometrics: BiometricService) {}

  @Get('status')
  @RequirePermissions('patients:read', 'patients:search', 'settings:manage')
  status() {
    return this.biometrics.status();
  }

  @Get('devices')
  @RequirePermissions('settings:manage')
  devices() {
    return this.biometrics.listDevices();
  }

  @Post('devices')
  @RequirePermissions('settings:manage')
  registerDevice(@Body() dto: RegisterBiometricDeviceDto, @Req() request: RequestContext) {
    return this.biometrics.registerDevice(dto, request);
  }

  @Patch('devices/:id/enabled')
  @RequirePermissions('settings:manage')
  setEnabled(
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
    @Req() request: RequestContext,
  ) {
    return this.biometrics.setDeviceEnabled(id, Boolean(body.enabled), request);
  }

  @Public()
  @Post('devices/heartbeat')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  heartbeat(@Body() dto: DeviceHeartbeatDto) {
    return this.biometrics.heartbeat(dto);
  }

  @Post('enroll')
  @RequirePermissions('patients:create', 'patients:update', 'settings:manage')
  enroll(@Body() dto: EnrollBiometricDto, @Req() request: RequestContext) {
    return this.biometrics.enroll(dto, request);
  }

  @Post('verify')
  @RequirePermissions('patients:read', 'patients:search', 'settings:manage')
  verify(@Body() dto: VerifyBiometricDto, @Req() request: RequestContext) {
    return this.biometrics.verify(dto, request);
  }

  @Post('identify')
  @RequirePermissions('patients:search', 'patients:read', 'settings:manage')
  identify(@Body() dto: IdentifyBiometricDto, @Req() request: RequestContext) {
    return this.biometrics.identify(dto, request);
  }

  @Get('patients/:patientId/identities')
  @RequirePermissions('patients:read', 'patients:search', 'settings:manage')
  listIdentities(@Param('patientId') patientId: string, @Req() request: RequestContext) {
    return this.biometrics.listIdentities(patientId, request);
  }

  @Get('patients/:patientId/context')
  @RequirePermissions('patients:read', 'patients:search', 'settings:manage')
  async identifiedContext(@Param('patientId') patientId: string, @Req() request: RequestContext) {
    await this.biometrics.listIdentities(patientId, request);
    return this.biometrics.patientContext(patientId);
  }

  @Post('identities/:id/unlink')
  @RequirePermissions('settings:manage')
  unlink(@Param('id') id: string, @Req() request: RequestContext) {
    return this.biometrics.unlink(id, request);
  }
}
