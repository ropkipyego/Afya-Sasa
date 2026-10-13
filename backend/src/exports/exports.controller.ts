import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { ExportsService } from './exports.service';

@ApiBearerAuth()
@ApiTags('Exports')
@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get()
  @RequirePermissions(
    'reports:read',
    'encounters:read',
    'lab_requests:read',
    'radiology_requests:read',
    'pharmacy:read',
    'admissions:read',
    'emergency:read',
    'payments:read',
    'surgery_bookings:read',
    'pregnancies:read',
    'icu_admissions:read',
    'hdu_admissions:read',
    'vitals:read',
  )
  list(@Req() request: RequestContext) {
    return this.exports.listAuthorized(request.user?.permissions ?? []);
  }

  @Get('patients/fields')
  @RequirePermissions('patients:read', 'reports:read')
  patientFields() {
    return this.exports.patientFields();
  }

  @Get('patients/preview')
  @RequirePermissions('patients:read', 'reports:read')
  previewPatients(
    @Req() request: RequestContext,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('fields') fields?: string,
  ) {
    return this.exports.buildPatientExport({
      format: 'csv',
      fields: fields?.split(',') ?? [],
      q,
      from,
      to,
      preview: true,
      request,
    });
  }

  @Get('patients/download')
  @RequirePermissions('patients:read', 'reports:read')
  async downloadPatients(
    @Req() request: RequestContext,
    @Res({ passthrough: false }) response: Response,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('fields') fields?: string,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
  ) {
    const file = await this.exports.buildPatientExport({
      format: format === 'xlsx' ? 'xlsx' : 'csv',
      fields: fields?.split(',') ?? [],
      q,
      from,
      to,
      request,
    });
    if (!('buffer' in file) || !file.buffer) {
      response.status(400).json(file);
      return;
    }
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.setHeader('X-Export-Rows', String(file.rowCount));
    response.send(file.buffer);
  }

  @Get(':dataset')
  @RequirePermissions(
    'reports:read',
    'encounters:read',
    'lab_requests:read',
    'radiology_requests:read',
    'pharmacy:read',
    'admissions:read',
    'emergency:read',
    'payments:read',
    'surgery_bookings:read',
    'pregnancies:read',
    'icu_admissions:read',
    'hdu_admissions:read',
    'vitals:read',
  )
  async download(
    @Param('dataset') dataset: string,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Req() request?: RequestContext,
    @Res({ passthrough: false }) response?: Response,
  ) {
    const file = await this.exports.build({
      dataset: dataset as never,
      format: format === 'xlsx' ? 'xlsx' : 'csv',
      from,
      to,
      status,
      patientId,
      request: request!,
    });
    response!.setHeader('Content-Type', file.mime);
    response!.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response!.setHeader('X-Export-Rows', String(file.rowCount));
    response!.send(file.buffer);
  }
}
