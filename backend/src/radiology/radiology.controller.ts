import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateModalityDto,
  CreateRadiologyAttachmentDto,
  CreateRadiologyReportDto,
  CreateRadiologyRequestDto,
  ImportRadiologyCatalogDto,
  UpdateRadiologyStatusDto,
} from './radiology.dto';
import { RadiologyService } from './radiology.service';

@ApiBearerAuth()
@ApiTags('Radiology')
@Controller('radiology')
export class RadiologyController {
  constructor(private readonly radiologyService: RadiologyService) {}

  @Get('modalities')
  @RequirePermissions('radiology_catalogue:read')
  listModalities() {
    return this.radiologyService.listModalities();
  }

  @Post('modalities')
  @RequirePermissions('radiology_catalogue:manage')
  createModality(@Body() dto: CreateModalityDto, @Req() request: RequestContext) {
    return this.radiologyService.createModality(dto, request);
  }

  @Post('modalities/import')
  @RequirePermissions('radiology_catalogue:manage')
  importCatalog(@Body() dto: ImportRadiologyCatalogDto, @Req() request: RequestContext) {
    return this.radiologyService.importCatalog(dto, request);
  }

  @Get('studies')
  @RequirePermissions('radiology_catalogue:read')
  listStudies(@Req() request: RequestContext) {
    return this.radiologyService.listStudies(request);
  }

  @Get('requests')
  @RequirePermissions('radiology_requests:read')
  listRequests(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.radiologyService.listRequests(
      status,
      limit !== undefined ? Number(limit) : undefined,
      offset !== undefined ? Number(offset) : undefined,
    );
  }

  @Get('requests/:id')
  @RequirePermissions('radiology_requests:read')
  detail(@Param('id') id: string) {
    return this.radiologyService.detail(id);
  }

  @Post('requests')
  @RequirePermissions('radiology_requests:create')
  createRequest(@Body() dto: CreateRadiologyRequestDto, @Req() request: RequestContext) {
    return this.radiologyService.createRequest(dto, request);
  }

  @Patch('requests/:id/status')
  @RequirePermissions('radiology_requests:update')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateRadiologyStatusDto, @Req() request: RequestContext) {
    return this.radiologyService.updateStatus(id, dto, request);
  }

  @Post('requests/:id/reports')
  @RequirePermissions('radiology_reports:create')
  createReport(@Param('id') id: string, @Body() dto: CreateRadiologyReportDto, @Req() request: RequestContext) {
    return this.radiologyService.createReport(id, dto, request);
  }

  @Post('requests/:id/verify')
  @RequirePermissions('radiology_reports:verify')
  verifyRequest(@Param('id') id: string, @Req() request: RequestContext) {
    return this.radiologyService.verifyRequest(id, request);
  }

  @Post('reports/:id/verify')
  @RequirePermissions('radiology_reports:verify')
  verifyReport(@Param('id') id: string, @Req() request: RequestContext) {
    return this.radiologyService.verifyReport(id, request);
  }

  @Post('requests/:id/attachments')
  @RequirePermissions('radiology_attachments:create')
  addAttachment(@Param('id') id: string, @Body() dto: CreateRadiologyAttachmentDto, @Req() request: RequestContext) {
    return this.radiologyService.addAttachment(id, dto, request);
  }

  @Get('reports/inbox')
  @RequirePermissions('radiology_reports:read')
  reportsInbox() {
    return this.radiologyService.reportsInbox();
  }

  @Post('reports/:id/review')
  @RequirePermissions('radiology_reports:read')
  reviewReport(@Param('id') id: string, @Req() request: RequestContext) {
    return this.radiologyService.reviewReport(id, request);
  }
}
