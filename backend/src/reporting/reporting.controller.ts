import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { ReportingService } from './reporting.service';

@ApiBearerAuth()
@ApiTags('Reporting')
@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('dashboard')
  @RequirePermissions('reports:read')
  dashboard() {
    return this.reportingService.dashboard();
  }

  @Get('opd-summary')
  @RequirePermissions('reports:read')
  opdSummary() {
    return this.reportingService.opdSummary();
  }

  @Get('admissions')
  @RequirePermissions('reports:read')
  admissionsReport() {
    return this.reportingService.admissionsReport();
  }

  @Get('discharges')
  @RequirePermissions('reports:read')
  dischargesReport() {
    return this.reportingService.dischargesReport();
  }

  @Get('bed-occupancy')
  @RequirePermissions('reports:read')
  bedOccupancyReport() {
    return this.reportingService.bedOccupancyReport();
  }

  @Get('emergency-stats')
  @RequirePermissions('reports:read')
  emergencyStats() {
    return this.reportingService.emergencyStats();
  }

  @Get('disease-register')
  @RequirePermissions('reports:read')
  diseaseRegister() {
    return this.reportingService.diseaseRegister();
  }

  @Get('moh-705')
  @RequirePermissions('reports:read')
  moh705() {
    return this.reportingService.moh705();
  }
}
