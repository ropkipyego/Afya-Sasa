import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  AssignEmergencyBayDto,
  CreateCriticalAlertDto,
  CreateEmergencyEncounterDto,
  CreateEmergencyNoteDto,
  CreateObservationLogDto,
  DispositionDto,
  EmergencyTriageDto,
  UpdateEmergencyWorkflowDto,
} from './emergency.dto';
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

  @Get('metrics')
  @RequirePermissions('emergency:read')
  metrics() {
    return this.emergencyService.dashboardMetrics();
  }

  @Get('queue')
  @RequirePermissions('emergency:read')
  queue() {
    return this.emergencyService.queue();
  }

  @Get('bays')
  @RequirePermissions('emergency_bays:read')
  bays() {
    return this.emergencyService.bayBoard();
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

  @Get(':id/workspace')
  @RequirePermissions('emergency:read')
  workspace(@Param('id') id: string) {
    return this.emergencyService.workspace(id);
  }

  @Post(':id/triage')
  @RequirePermissions('emergency:create')
  triage(@Param('id') id: string, @Body() dto: EmergencyTriageDto, @Req() request: RequestContext) {
    return this.emergencyService.triage(id, dto, request);
  }

  @Post(':id/assign-bay')
  @RequirePermissions('emergency_bays:manage')
  assignBay(@Param('id') id: string, @Body() dto: AssignEmergencyBayDto, @Req() request: RequestContext) {
    return this.emergencyService.assignBay(id, dto, request);
  }

  @Patch(':id/workflow')
  @RequirePermissions('emergency:create')
  updateWorkflow(
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyWorkflowDto,
    @Req() request: RequestContext,
  ) {
    return this.emergencyService.updateWorkflow(id, dto, request);
  }

  @Post(':id/notes')
  @RequirePermissions('emergency:create')
  addNote(@Param('id') id: string, @Body() dto: CreateEmergencyNoteDto, @Req() request: RequestContext) {
    return this.emergencyService.addNote(id, dto, request);
  }

  @Post(':id/observation')
  @RequirePermissions('emergency:create')
  addObservation(
    @Param('id') id: string,
    @Body() dto: CreateObservationLogDto,
    @Req() request: RequestContext,
  ) {
    return this.emergencyService.addObservationLog(id, dto, request);
  }

  @Post(':id/disposition')
  @RequirePermissions('emergency:dispose')
  disposition(@Param('id') id: string, @Body() dto: DispositionDto, @Req() request: RequestContext) {
    return this.emergencyService.disposition(id, dto, request);
  }
}
