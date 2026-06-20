import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateHduAdmissionDto,
  CreateHduObservationDto,
  CreateHduRoundDto,
  UpdateHduStatusDto,
} from './hdu.dto';
import { HduService } from './hdu.service';

@ApiBearerAuth()
@ApiTags('HDU')
@Controller('hdu')
export class HduController {
  constructor(private readonly hduService: HduService) {}

  @Get('admissions')
  @RequirePermissions('hdu_admissions:read')
  list(@Query('status') status?: 'active' | 'transferred_out' | 'discharged' | 'died') {
    return this.hduService.list(status);
  }

  @Post('admissions')
  @RequirePermissions('hdu_admissions:create')
  admit(@Body() dto: CreateHduAdmissionDto, @Req() request: RequestContext) {
    return this.hduService.admit(dto, request);
  }

  @Patch('admissions/:id/status')
  @RequirePermissions('hdu_admissions:update')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateHduStatusDto, @Req() request: RequestContext) {
    return this.hduService.updateStatus(id, dto, request);
  }

  @Post('admissions/:id/observations')
  @RequirePermissions('hdu_observations:create')
  observe(@Param('id') id: string, @Body() dto: CreateHduObservationDto, @Req() request: RequestContext) {
    return this.hduService.observe(id, dto, request);
  }

  @Post('admissions/:id/rounds')
  @RequirePermissions('hdu_rounds:create')
  round(@Param('id') id: string, @Body() dto: CreateHduRoundDto, @Req() request: RequestContext) {
    return this.hduService.round(id, dto, request);
  }
}
