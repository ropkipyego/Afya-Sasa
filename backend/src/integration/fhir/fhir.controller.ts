import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../core/auth/auth.decorators';
import { FhirService } from './fhir.service';

@ApiBearerAuth()
@ApiTags('FHIR')
@Controller('integrations/fhir')
export class FhirController {
  constructor(private readonly fhir: FhirService) {}

  @Get('status')
  @RequirePermissions('settings:manage', 'reports:read')
  status() {
    return this.fhir.status();
  }

  @Get('validate-synthetic')
  @RequirePermissions('settings:manage')
  synthetic() {
    return this.fhir.validateSynthetic();
  }

  @Get('patient/:id')
  @RequirePermissions('settings:manage', 'patients:read')
  patient(@Param('id') id: string) {
    return this.fhir.mapPatientById(id);
  }

  @Get('encounter/:id')
  @RequirePermissions('settings:manage', 'encounters:read')
  encounter(@Param('id') id: string) {
    return this.fhir.mapEncounterById(id);
  }
}
