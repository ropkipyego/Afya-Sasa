import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateAdmissionDto,
  CreateBedDto,
  CreateDischargeSummaryDto,
  CreateProgressNoteDto,
  CreateWardDto,
  DischargeAdmissionDto,
  TransferBedDto,
  UpdateBedStatusDto,
  UpdateWardDto,
} from './inpatient.dto';
import { InpatientService } from './inpatient.service';

@ApiBearerAuth()
@ApiTags('Inpatient')
@Controller('inpatient')
export class InpatientController {
  constructor(private readonly inpatientService: InpatientService) {}

  @Get('wards')
  @RequirePermissions('wards:read')
  listWards() {
    return this.inpatientService.listWards();
  }

  @Post('wards')
  @RequirePermissions('wards:manage')
  createWard(@Body() dto: CreateWardDto, @Req() request: RequestContext) {
    return this.inpatientService.createWard(dto, request);
  }

  @Patch('wards/:id')
  @RequirePermissions('wards:manage')
  updateWard(@Param('id') id: string, @Body() dto: UpdateWardDto, @Req() request: RequestContext) {
    return this.inpatientService.updateWard(id, dto, request);
  }

  @Get('beds')
  @RequirePermissions('beds:read')
  listBeds(@Query('wardId') wardId?: string) {
    return this.inpatientService.listBeds(wardId);
  }

  @Get('beds/available')
  @RequirePermissions('beds:read')
  availableBeds() {
    return this.inpatientService.availableBeds();
  }

  @Get('beds/dashboard')
  @RequirePermissions('beds:read')
  bedDashboard() {
    return this.inpatientService.bedDashboard();
  }

  @Post('beds')
  @RequirePermissions('beds:manage')
  createBed(@Body() dto: CreateBedDto, @Req() request: RequestContext) {
    return this.inpatientService.createBed(dto, request);
  }

  @Patch('beds/:id/status')
  @RequirePermissions('beds:manage')
  updateBedStatus(@Param('id') id: string, @Body() dto: UpdateBedStatusDto, @Req() request: RequestContext) {
    return this.inpatientService.updateBedStatus(id, dto, request);
  }

  @Get('dashboard')
  @RequirePermissions('beds:read')
  dashboard() {
    return this.inpatientService.getDashboard();
  }

  @Get('wards/:id/census')
  @RequirePermissions('beds:read')
  wardCensus(@Param('id') id: string) {
    return this.inpatientService.getWardCensus(id);
  }

  @Get('admissions/:id/workspace')
  @RequirePermissions('admissions:read')
  admissionWorkspace(@Param('id') id: string) {
    return this.inpatientService.getAdmissionWorkspace(id);
  }

  @Get('admissions')
  @RequirePermissions('admissions:read')
  listAdmissions(@Query('status') status?: 'active' | 'discharged', @Query('wardId') wardId?: string) {
    return this.inpatientService.listAdmissions(status, wardId);
  }

  @Post('admissions')
  @RequirePermissions('admissions:create')
  createAdmission(@Body() dto: CreateAdmissionDto, @Req() request: RequestContext) {
    return this.inpatientService.createAdmission(dto, request);
  }

  @Post('admissions/:id/transfers')
  @RequirePermissions('admissions:transfer')
  transferBed(@Param('id') id: string, @Body() dto: TransferBedDto, @Req() request: RequestContext) {
    return this.inpatientService.transferBed(id, dto, request);
  }

  @Post('admissions/:id/progress-notes')
  @RequirePermissions('progress_notes:create')
  addProgressNote(@Param('id') id: string, @Body() dto: CreateProgressNoteDto, @Req() request: RequestContext) {
    return this.inpatientService.addProgressNote(id, dto, request);
  }

  @Post('admissions/:id/discharge-summary')
  @RequirePermissions('discharge_summaries:create')
  createDischargeSummary(@Param('id') id: string, @Body() dto: CreateDischargeSummaryDto, @Req() request: RequestContext) {
    return this.inpatientService.createDischargeSummary(id, dto, request);
  }

  @Post('discharge-summaries/:id/complete')
  @RequirePermissions('discharge_summaries:complete')
  completeDischargeSummary(@Param('id') id: string, @Req() request: RequestContext) {
    return this.inpatientService.completeDischargeSummary(id, request);
  }

  @Post('admissions/:id/discharge')
  @RequirePermissions('admissions:discharge')
  dischargeAdmission(@Param('id') id: string, @Body() dto: DischargeAdmissionDto, @Req() request: RequestContext) {
    return this.inpatientService.dischargeAdmission(id, dto, request);
  }
}
