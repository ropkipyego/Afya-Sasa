import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreatePatientDto,
  PatientAllergyDto,
  PatientChronicConditionDto,
  PatientIdentifierDto,
  PatientNextOfKinDto,
  UpdatePatientAllergyDto,
  UpdatePatientChronicConditionDto,
  UpdatePatientDto,
  UpdatePatientIdentifierDto,
  UpdatePatientNextOfKinDto,
} from './patient.dto';
import { PatientsService } from './patients.service';

@ApiBearerAuth()
@ApiTags('Patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @RequirePermissions('patients:search', 'patients:read')
  search(
    @Query('q') q?: string,
    @Query('identifier') identifier?: string,
    @Query('phone') phone?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.patientsService.search({
      q,
      identifier,
      phone,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post()
  @RequirePermissions('patients:create')
  create(@Body() dto: CreatePatientDto, @Req() request: RequestContext) {
    return this.patientsService.create(dto, request);
  }

  @Post('duplicates')
  @RequirePermissions('patients:search')
  detectDuplicates(@Body() dto: CreatePatientDto) {
    return this.patientsService.detectDuplicates(dto);
  }

  @Get('qr/:qrCode')
  @RequirePermissions('patients:read')
  findByQr(@Param('qrCode') qrCode: string) {
    return this.patientsService.findByQr(qrCode);
  }

  @Get(':id/history')
  @RequirePermissions('patients:history')
  history(@Param('id') id: string) {
    return this.patientsService.history(id);
  }

  @Get(':id/qr-card')
  @RequirePermissions('patients:read')
  qrCard(@Param('id') id: string) {
    return this.patientsService.qrCard(id);
  }

  @Get(':id')
  @RequirePermissions('patients:read')
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('patients:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @Req() request: RequestContext,
  ) {
    return this.patientsService.update(id, dto, request);
  }

  @Delete(':id')
  @RequirePermissions('patients:delete')
  softDelete(@Param('id') id: string) {
    return this.patientsService.softDelete(id);
  }

  @Post(':id/identifiers')
  @RequirePermissions('patient_identifiers:manage')
  addIdentifier(
    @Param('id') id: string,
    @Body() dto: PatientIdentifierDto,
    @Req() request: RequestContext,
  ) {
    return this.patientsService.addIdentifier(id, dto, request);
  }

  @Patch(':id/identifiers/:identifierId')
  @RequirePermissions('patient_identifiers:manage')
  updateIdentifier(
    @Param('id') id: string,
    @Param('identifierId') identifierId: string,
    @Body() dto: UpdatePatientIdentifierDto,
    @Req() request: RequestContext,
  ) {
    return this.patientsService.updateIdentifier(
      id,
      identifierId,
      dto,
      request,
    );
  }

  @Delete(':id/identifiers/:identifierId')
  @RequirePermissions('patient_identifiers:manage')
  removeIdentifier(
    @Param('id') id: string,
    @Param('identifierId') identifierId: string,
  ) {
    return this.patientsService.removeIdentifier(id, identifierId);
  }

  @Post(':id/next-of-kin')
  @RequirePermissions('patient_next_of_kin:manage')
  addNextOfKin(
    @Param('id') id: string,
    @Body() dto: PatientNextOfKinDto,
    @Req() request: RequestContext,
  ) {
    return this.patientsService.addNextOfKin(id, dto, request);
  }

  @Patch(':id/next-of-kin/:nextOfKinId')
  @RequirePermissions('patient_next_of_kin:manage')
  updateNextOfKin(
    @Param('id') id: string,
    @Param('nextOfKinId') nextOfKinId: string,
    @Body() dto: UpdatePatientNextOfKinDto,
    @Req() request: RequestContext,
  ) {
    return this.patientsService.updateNextOfKin(id, nextOfKinId, dto, request);
  }

  @Delete(':id/next-of-kin/:nextOfKinId')
  @RequirePermissions('patient_next_of_kin:manage')
  removeNextOfKin(
    @Param('id') id: string,
    @Param('nextOfKinId') nextOfKinId: string,
  ) {
    return this.patientsService.removeNextOfKin(id, nextOfKinId);
  }

  @Post(':id/allergies')
  @RequirePermissions('patient_allergies:manage')
  addAllergy(
    @Param('id') id: string,
    @Body() dto: PatientAllergyDto,
    @Req() request: RequestContext,
  ) {
    return this.patientsService.addAllergy(id, dto, request);
  }

  @Patch(':id/allergies/:allergyId')
  @RequirePermissions('patient_allergies:manage')
  updateAllergy(
    @Param('id') id: string,
    @Param('allergyId') allergyId: string,
    @Body() dto: UpdatePatientAllergyDto,
    @Req() request: RequestContext,
  ) {
    return this.patientsService.updateAllergy(id, allergyId, dto, request);
  }

  @Delete(':id/allergies/:allergyId')
  @RequirePermissions('patient_allergies:manage')
  removeAllergy(@Param('id') id: string, @Param('allergyId') allergyId: string) {
    return this.patientsService.removeAllergy(id, allergyId);
  }

  @Post(':id/chronic-conditions')
  @RequirePermissions('patient_chronic_conditions:manage')
  addChronicCondition(
    @Param('id') id: string,
    @Body() dto: PatientChronicConditionDto,
    @Req() request: RequestContext,
  ) {
    return this.patientsService.addChronicCondition(id, dto, request);
  }

  @Patch(':id/chronic-conditions/:conditionId')
  @RequirePermissions('patient_chronic_conditions:manage')
  updateChronicCondition(
    @Param('id') id: string,
    @Param('conditionId') conditionId: string,
    @Body() dto: UpdatePatientChronicConditionDto,
    @Req() request: RequestContext,
  ) {
    return this.patientsService.updateChronicCondition(
      id,
      conditionId,
      dto,
      request,
    );
  }

  @Delete(':id/chronic-conditions/:conditionId')
  @RequirePermissions('patient_chronic_conditions:manage')
  removeChronicCondition(
    @Param('id') id: string,
    @Param('conditionId') conditionId: string,
  ) {
    return this.patientsService.removeChronicCondition(id, conditionId);
  }
}
