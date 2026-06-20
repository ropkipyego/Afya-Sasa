import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateFluidBalanceDto,
  CreateIcuAdmissionDto,
  CreateIcuObservationDto,
  CreateIcuRoundDto,
  CreateVentilatorRecordDto,
  UpdateIcuStatusDto,
} from './icu.dto';
import { IcuService } from './icu.service';

@ApiBearerAuth()
@ApiTags('ICU')
@Controller('icu')
export class IcuController {
  constructor(private readonly icuService: IcuService) {}

  @Get('admissions')
  @RequirePermissions('icu_admissions:read')
  list(@Query('status') status?: 'active' | 'transferred_out' | 'discharged' | 'died') {
    return this.icuService.list(status);
  }

  @Post('admissions')
  @RequirePermissions('icu_admissions:create')
  admit(@Body() dto: CreateIcuAdmissionDto, @Req() request: RequestContext) {
    return this.icuService.admit(dto, request);
  }

  @Patch('admissions/:id/status')
  @RequirePermissions('icu_admissions:update')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateIcuStatusDto, @Req() request: RequestContext) {
    return this.icuService.updateStatus(id, dto, request);
  }

  @Post('admissions/:id/observations')
  @RequirePermissions('icu_observations:create')
  observe(@Param('id') id: string, @Body() dto: CreateIcuObservationDto, @Req() request: RequestContext) {
    return this.icuService.observe(id, dto, request);
  }

  @Post('admissions/:id/ventilator-records')
  @RequirePermissions('ventilator_records:create')
  ventilator(@Param('id') id: string, @Body() dto: CreateVentilatorRecordDto, @Req() request: RequestContext) {
    return this.icuService.ventilator(id, dto, request);
  }

  @Post('admissions/:id/fluid-balance')
  @RequirePermissions('fluid_balance:create')
  fluid(@Param('id') id: string, @Body() dto: CreateFluidBalanceDto, @Req() request: RequestContext) {
    return this.icuService.fluid(id, dto, request);
  }

  @Post('admissions/:id/rounds')
  @RequirePermissions('icu_rounds:create')
  round(@Param('id') id: string, @Body() dto: CreateIcuRoundDto, @Req() request: RequestContext) {
    return this.icuService.round(id, dto, request);
  }
}
