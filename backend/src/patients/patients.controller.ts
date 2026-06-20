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
import { CreatePatientDto, UpdatePatientDto } from './patient.dto';
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

  @Get('qr/:qrCode')
  @RequirePermissions('patients:read')
  findByQr(@Param('qrCode') qrCode: string) {
    return this.patientsService.findByQr(qrCode);
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
}
