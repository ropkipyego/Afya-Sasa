import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateAttachmentDto,
  CreateClinicalNoteDto,
  CreateConsultationDto,
  CreateDiagnosisDto,
  CreateEncounterDto,
  CreateTriageDto,
  UpdateConsultationDto,
  UpdateEncounterStatusDto,
} from './opd.dto';
import { OpdService } from './opd.service';

@ApiBearerAuth()
@ApiTags('OPD')
@Controller('opd')
export class OpdController {
  constructor(private readonly opdService: OpdService) {}

  @Get('encounters')
  @RequirePermissions('encounters:read')
  listEncounters(
    @Query('patientId') patientId?: string,
    @Query('status') status?: never,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.opdService.listEncounters({ patientId, status, doctorId });
  }

  @Post('encounters')
  @RequirePermissions('encounters:create')
  createEncounter(@Body() dto: CreateEncounterDto, @Req() request: RequestContext) {
    return this.opdService.createEncounter(dto, request);
  }

  @Get('encounters/:id')
  @RequirePermissions('encounters:read')
  getEncounter(@Param('id') id: string) {
    return this.opdService.getEncounter(id);
  }

  @Patch('encounters/:id/status')
  @RequirePermissions('encounters:update')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEncounterStatusDto,
    @Req() request: RequestContext,
  ) {
    return this.opdService.updateStatus(id, dto.status, request);
  }

  @Get('triage/queue')
  @RequirePermissions('triage:read')
  triageQueue() {
    return this.opdService.triageQueue();
  }

  @Post('encounters/:id/triage')
  @RequirePermissions('triage:create')
  triage(
    @Param('id') id: string,
    @Body() dto: CreateTriageDto,
    @Req() request: RequestContext,
  ) {
    return this.opdService.triage(id, dto, request);
  }

  @Get('doctor/queue')
  @RequirePermissions('consultations:read')
  doctorQueue() {
    return this.opdService.doctorQueue();
  }

  @Post('encounters/:id/consultations')
  @RequirePermissions('consultations:create')
  createConsultation(
    @Param('id') id: string,
    @Body() dto: CreateConsultationDto,
    @Req() request: RequestContext,
  ) {
    return this.opdService.createConsultation(id, dto, request);
  }

  @Patch('consultations/:id')
  @RequirePermissions('consultations:update')
  updateConsultation(
    @Param('id') id: string,
    @Body() dto: UpdateConsultationDto,
    @Req() request: RequestContext,
  ) {
    return this.opdService.updateConsultation(id, dto, request);
  }

  @Post('consultations/:id/complete')
  @RequirePermissions('consultations:update')
  completeConsultation(@Param('id') id: string, @Req() request: RequestContext) {
    return this.opdService.completeConsultation(id, request);
  }

  @Post('encounters/:id/diagnoses')
  @RequirePermissions('diagnoses:create')
  addDiagnosis(
    @Param('id') id: string,
    @Body() dto: CreateDiagnosisDto,
    @Req() request: RequestContext,
  ) {
    return this.opdService.addDiagnosis(id, dto, request);
  }

  @Post('encounters/:id/notes')
  @RequirePermissions('clinical_notes:create')
  addNote(
    @Param('id') id: string,
    @Body() dto: CreateClinicalNoteDto,
    @Req() request: RequestContext,
  ) {
    return this.opdService.addNote(id, dto, request);
  }

  @Post('encounters/:id/attachments')
  @RequirePermissions('encounter_attachments:create')
  addAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentDto,
    @Req() request: RequestContext,
  ) {
    return this.opdService.addAttachment(id, dto, request);
  }

  @Get('reports/summary')
  @RequirePermissions('reports:read')
  opdSummary() {
    return this.opdService.opdSummary();
  }
}
