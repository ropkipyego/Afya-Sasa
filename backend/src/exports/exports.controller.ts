import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RequestContext } from '../common/request-context';
import { EXPORT_DATASETS, ExportsService } from './exports.service';

@ApiBearerAuth()
@ApiTags('Exports')
@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get()
  list() {
    return EXPORT_DATASETS.map((dataset) => ({ dataset }));
  }

  @Get(':dataset')
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
