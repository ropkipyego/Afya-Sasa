import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { CreateReferralDto, UpdateReferralStatusDto } from './referral.dto';
import { ReferralsService } from './referrals.service';

@ApiBearerAuth()
@ApiTags('Referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get()
  @RequirePermissions('referrals:read')
  list(@Query('patientId') patientId?: string, @Query('status') status?: string) {
    return this.referralsService.list(patientId, status);
  }

  @Post()
  @RequirePermissions('referrals:create')
  create(@Body() dto: CreateReferralDto, @Req() request: RequestContext) {
    return this.referralsService.create(dto, request);
  }

  @Patch(':id/status')
  @RequirePermissions('referrals:update')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateReferralStatusDto, @Req() request: RequestContext) {
    return this.referralsService.updateStatus(id, dto, request);
  }
}
