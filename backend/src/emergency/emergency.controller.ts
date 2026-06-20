import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { CreateCriticalAlertDto, CreateEmergencyEncounterDto, DispositionDto } from './emergency.dto';
import { EmergencyService } from './emergency.service';

@ApiBearerAuth()
@ApiTags('Emergency')
@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post('register')
  @RequirePermissions('emergency:create')
  register(@Body() dto: CreateEmergencyEncounterDto, @Req() request: RequestContext) {
    return this.emergencyService.register(dto, request);
  }

  @Get('dashboard')
  @RequirePermissions('emergency:read')
  dashboard() {
    return this.emergencyService.dashboard();
  }

  @Post(':id/disposition')
  @RequirePermissions('emergency:dispose')
  disposition(@Param('id') id: string, @Body() dto: DispositionDto, @Req() request: RequestContext) {
    return this.emergencyService.disposition(id, dto, request);
  }

  @Get('alerts')
  @RequirePermissions('critical_alerts:read')
  activeAlerts() {
    return this.emergencyService.activeAlerts();
  }

  @Post('alerts')
  @RequirePermissions('critical_alerts:create')
  createAlert(@Body() dto: CreateCriticalAlertDto, @Req() request: RequestContext) {
    return this.emergencyService.createAlert(dto, request);
  }

  @Post('alerts/:id/acknowledge')
  @RequirePermissions('critical_alerts:acknowledge')
  acknowledgeAlert(@Param('id') id: string, @Req() request: RequestContext) {
    return this.emergencyService.acknowledgeAlert(id, request);
  }
}
