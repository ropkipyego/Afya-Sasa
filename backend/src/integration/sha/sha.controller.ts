import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../../common/request-context';
import { RequirePermissions } from '../../core/auth/auth.decorators';
import { CheckShaEligibilityDto } from './sha.dto';
import { ShaService } from './sha.service';

@ApiBearerAuth()
@ApiTags('SHA')
@Controller('sha')
export class ShaController {
  constructor(private readonly shaService: ShaService) {}

  @Get('status')
  @RequirePermissions('patients:read', 'settings:manage')
  status() {
    return this.shaService.status();
  }

  @Get('eligibility/patient/:patientId')
  @RequirePermissions('patients:read')
  latest(@Param('patientId') patientId: string) {
    return this.shaService.latestForPatient(patientId);
  }

  @Get('coverage/patient/:patientId')
  @RequirePermissions('patients:read')
  coverage(@Param('patientId') patientId: string) {
    return this.shaService.coverageForPatient(patientId);
  }

  @Post('eligibility')
  @RequirePermissions('patients:read', 'patients:search')
  check(@Body() dto: CheckShaEligibilityDto, @Req() request: RequestContext) {
    return this.shaService.check(dto, request);
  }
}
