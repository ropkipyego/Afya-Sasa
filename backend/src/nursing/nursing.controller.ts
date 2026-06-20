import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateMarDto,
  CreateObservationDto,
  CreateShiftNoteDto,
  CreateVitalSignsDto,
  UpdateMarStatusDto,
} from './nursing.dto';
import { NursingService } from './nursing.service';

@ApiBearerAuth()
@ApiTags('Nursing')
@Controller('nursing')
export class NursingController {
  constructor(private readonly nursingService: NursingService) {}

  @Post('vitals')
  @RequirePermissions('vitals:create')
  createVitals(@Body() dto: CreateVitalSignsDto, @Req() request: RequestContext) {
    return this.nursingService.createVitals(dto, request);
  }

  @Get('vitals')
  @RequirePermissions('vitals:read')
  listVitals(@Query('admissionId') admissionId?: string, @Query('encounterId') encounterId?: string) {
    return this.nursingService.listVitals(admissionId, encounterId);
  }

  @Post('mar')
  @RequirePermissions('mar:manage')
  createMar(@Body() dto: CreateMarDto, @Req() request: RequestContext) {
    return this.nursingService.createMar(dto, request);
  }

  @Get('mar/:admissionId')
  @RequirePermissions('mar:read')
  marForAdmission(@Param('admissionId') admissionId: string) {
    return this.nursingService.marForAdmission(admissionId);
  }

  @Patch('mar/:id/status')
  @RequirePermissions('mar:manage')
  updateMarStatus(@Param('id') id: string, @Body() dto: UpdateMarStatusDto, @Req() request: RequestContext) {
    return this.nursingService.updateMarStatus(id, dto, request);
  }

  @Post('shift-notes')
  @RequirePermissions('shift_notes:create')
  createShiftNote(@Body() dto: CreateShiftNoteDto, @Req() request: RequestContext) {
    return this.nursingService.createShiftNote(dto, request);
  }

  @Get('shift-notes')
  @RequirePermissions('shift_notes:read')
  listShiftNotes(@Query('wardId') wardId?: string, @Query('date') date?: string) {
    return this.nursingService.listShiftNotes(wardId, date);
  }

  @Post('observations')
  @RequirePermissions('nursing_observations:create')
  createObservation(@Body() dto: CreateObservationDto, @Req() request: RequestContext) {
    return this.nursingService.createObservation(dto, request);
  }

  @Get('observations/:admissionId')
  @RequirePermissions('nursing_observations:read')
  observationsForAdmission(@Param('admissionId') admissionId: string) {
    return this.nursingService.observationsForAdmission(admissionId);
  }
}
