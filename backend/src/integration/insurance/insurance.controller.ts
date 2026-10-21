import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../../common/request-context';
import { RequirePermissions } from '../../core/auth/auth.decorators';
import { InsuranceService } from './insurance.service';
import type { InsuranceClaimStatus, InsurancePayerType } from './insurance-lifecycle';

@ApiBearerAuth()
@ApiTags('Insurance')
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly insurance: InsuranceService) {}

  @Get('workspace')
  @RequirePermissions('payments:read')
  workspace(@Req() request: RequestContext) {
    return this.insurance.workspace(request);
  }

  @Post('payers')
  @RequirePermissions('settings:manage', 'payments:manage')
  savePayer(
    @Body()
    body: { id?: string; type: InsurancePayerType; name: string; active?: boolean; notes?: string },
    @Req() request: RequestContext,
  ) {
    return this.insurance.savePayer(body, request);
  }

  @Post('claims')
  @RequirePermissions('payments:read', 'payments:initiate', 'payments:manage')
  prepare(
    @Body() body: { patientId: string; payerId: string; chargeIds: string[] },
    @Req() request: RequestContext,
  ) {
    return this.insurance.prepareClaim(body, request);
  }

  @Patch('claims/:id')
  @RequirePermissions('payments:read', 'payments:initiate', 'payments:manage')
  transition(
    @Param('id') id: string,
    @Body()
    body: {
      status: InsuranceClaimStatus;
      externalReference?: string;
      approvedAmount?: number | null;
      reason?: string;
    },
    @Req() request: RequestContext,
  ) {
    return this.insurance.transitionClaim(id, body, request);
  }
}
