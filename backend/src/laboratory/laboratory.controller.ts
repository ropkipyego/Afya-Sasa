import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  AmendLabResultDto,
  CancelLabRequestDto,
  CollectSampleDto,
  CreateLabAttachmentDto,
  CreateLabPanelDto,
  CreateLabRequestDto,
  CreateLabTestDto,
  EnterLabPanelResultsDto,
  EnterLabResultDto,
  ImportLabCatalogDto,
  ReceiveSampleDto,
  ScanLabSampleDto,
} from './laboratory.dto';
import { LaboratoryService } from './laboratory.service';
import { BloodBankService } from './blood-bank.service';
import { LAB_REPORT_LAYOUTS } from './lab-report-layouts';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CreateBloodBankRequestDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  admissionId?: string;

  @ApiProperty({ enum: ['packed_red_cells', 'whole_blood', 'ffp', 'platelets', 'cryoprecipitate'] })
  @IsIn(['packed_red_cells', 'whole_blood', 'ffp', 'platelets', 'cryoprecipitate'])
  product!: 'packed_red_cells' | 'whole_blood' | 'ffp' | 'platelets' | 'cryoprecipitate';

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  units!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientBloodGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indication?: string;
}

class UpdateBloodBankStatusDto {
  @ApiProperty({ enum: ['requested', 'grouped', 'crossmatched', 'issued', 'cancelled'] })
  @IsIn(['requested', 'grouped', 'crossmatched', 'issued', 'cancelled'])
  status!: 'requested' | 'grouped' | 'crossmatched' | 'issued' | 'cancelled';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupingResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  crossmatchResult?: string;
}

@ApiBearerAuth()
@ApiTags('Laboratory')
@Controller('laboratory')
export class LaboratoryController {
  constructor(
    private readonly laboratoryService: LaboratoryService,
    private readonly bloodBank: BloodBankService,
  ) {}

  @Get('blood-bank')
  @RequirePermissions('lab_requests:read')
  listBloodBank() {
    return this.bloodBank.list();
  }

  @Get('blood-bank/stock')
  @RequirePermissions('lab_requests:read')
  bloodBankStock(@Query('from') from?: string, @Query('to') to?: string) {
    return this.bloodBank.stock(from, to);
  }

  @Get('blood-bank/units')
  @RequirePermissions('lab_requests:read')
  listBloodBankUnits() {
    return this.bloodBank.listUnits();
  }

  @Post('blood-bank')
  @RequirePermissions('lab_requests:create')
  createBloodBank(@Body() dto: CreateBloodBankRequestDto, @Req() request: RequestContext) {
    return this.bloodBank.create(dto, request);
  }

  @Post('blood-bank/:id/status')
  @RequirePermissions('lab_results:enter', 'lab_results:verify')
  updateBloodBank(
    @Param('id') id: string,
    @Body() dto: UpdateBloodBankStatusDto,
    @Req() request: RequestContext,
  ) {
    return this.bloodBank.updateStatus(id, dto, request);
  }

  @Post('blood-bank/units')
  @RequirePermissions('lab_requests:create', 'lab_results:enter')
  registerBloodUnit(
    @Body()
    dto: {
      unitNo: string
      product: 'packed_red_cells' | 'whole_blood' | 'ffp' | 'platelets' | 'cryoprecipitate'
      bloodGroup: string
      expiresAt: string
      collectedAt?: string
      location?: string
    },
    @Req() request: RequestContext,
  ) {
    return this.bloodBank.registerUnit(dto, request);
  }

  @Post('blood-bank/units/:id/status')
  @RequirePermissions('lab_results:enter', 'lab_results:verify')
  transitionBloodUnit(
    @Param('id') id: string,
    @Body()
    dto: {
      status: 'received' | 'available' | 'reserved' | 'issued' | 'expired' | 'quarantined' | 'discarded'
      screeningStatus?: 'awaiting_screening' | 'reactive' | 'released' | 'quarantine'
      reservedRequestId?: string | null
      reason?: string
    },
    @Req() request: RequestContext,
  ) {
    return this.bloodBank.transitionUnit(id, dto, request);
  }

  @Get('report-layouts')
  @RequirePermissions('lab_requests:read', 'lab_catalogue:read')
  reportLayouts() {
    return {
      note: 'Structural groupings only. Units and reference intervals come from the laboratory catalogue. Missing catalogue values must be reviewed — they are not defaulted to normal.',
      layouts: LAB_REPORT_LAYOUTS,
    };
  }

  @Get('panels')
  @RequirePermissions('lab_catalogue:read')
  listPanels() {
    return this.laboratoryService.listPanels();
  }

  @Post('panels')
  @RequirePermissions('lab_catalogue:manage')
  createPanel(@Body() dto: CreateLabPanelDto, @Req() request: RequestContext) {
    return this.laboratoryService.createPanel(dto, request);
  }

  @Get('tests')
  @RequirePermissions('lab_catalogue:read', 'payments:initiate')
  listTests() {
    return this.laboratoryService.listTests();
  }

  @Post('tests')
  @RequirePermissions('lab_catalogue:manage')
  createTest(@Body() dto: CreateLabTestDto, @Req() request: RequestContext) {
    return this.laboratoryService.createTest(dto, request);
  }

  @Post('tests/import')
  @RequirePermissions('lab_catalogue:manage', 'settings:manage')
  importTests(@Body() dto: ImportLabCatalogDto, @Req() request: RequestContext) {
    return this.laboratoryService.importCatalog(dto, request);
  }

  @Get('requests')
  @RequirePermissions('lab_requests:read')
  listRequests(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.laboratoryService.listRequests(
      status,
      limit !== undefined ? Number(limit) : undefined,
      offset !== undefined ? Number(offset) : undefined,
    );
  }

  @Post('requests')
  @RequirePermissions('lab_requests:create')
  createRequest(@Body() dto: CreateLabRequestDto, @Req() request: RequestContext) {
    return this.laboratoryService.createRequest(dto, request);
  }

  @Get('patients/:patientId/requests')
  @RequirePermissions('lab_requests:read')
  patientRequests(@Param('patientId') patientId: string) {
    return this.laboratoryService.listPatientRequests(patientId);
  }

  @Get('patients/:patientId/attachments')
  @RequirePermissions('lab_attachments:read')
  patientAttachments(@Param('patientId') patientId: string) {
    return this.laboratoryService.listPatientAttachments(patientId);
  }

  @Get('requests/:id')
  @RequirePermissions('lab_requests:read')
  detail(@Param('id') id: string) {
    return this.laboratoryService.detail(id);
  }

  @Get('samples/barcode/:code')
  @RequirePermissions('lab_requests:read', 'lab_samples:collect', 'lab_samples:receive')
  findSampleByBarcode(@Param('code') code: string) {
    return this.laboratoryService.findSampleByBarcode(decodeURIComponent(code));
  }

  @Post('samples/scan')
  @RequirePermissions('lab_samples:collect', 'lab_samples:receive', 'lab_requests:read')
  scanSample(@Body() dto: ScanLabSampleDto, @Req() request: RequestContext) {
    return this.laboratoryService.scanSample(dto, request);
  }

  @Post('requests/:id/samples')
  @RequirePermissions('lab_samples:collect')
  collectSample(@Param('id') id: string, @Body() dto: CollectSampleDto, @Req() request: RequestContext) {
    return this.laboratoryService.collectSample(id, dto, request);
  }

  @Post('samples/:id/receive')
  @RequirePermissions('lab_samples:receive')
  receiveSample(@Param('id') id: string, @Body() dto: ReceiveSampleDto, @Req() request: RequestContext) {
    return this.laboratoryService.receiveSample(id, dto, request);
  }

  @Post('requests/:id/attachments')
  @RequirePermissions('lab_attachments:create')
  addAttachment(
    @Param('id') id: string,
    @Body() dto: CreateLabAttachmentDto,
    @Req() request: RequestContext,
  ) {
    return this.laboratoryService.addAttachment(id, dto, request);
  }

  @Delete('attachments/:attachmentId')
  @RequirePermissions('lab_attachments:delete')
  deleteAttachment(@Param('attachmentId') attachmentId: string, @Req() request: RequestContext) {
    return this.laboratoryService.deleteAttachment(attachmentId, request);
  }

  @Post('results')
  @RequirePermissions('lab_results:enter')
  enterResult(@Body() dto: EnterLabResultDto, @Req() request: RequestContext) {
    return this.laboratoryService.enterResult(dto, request);
  }

  @Post('results/panel')
  @RequirePermissions('lab_results:enter')
  enterPanelResults(@Body() dto: EnterLabPanelResultsDto, @Req() request: RequestContext) {
    return this.laboratoryService.enterPanelResults(dto, request);
  }

  @Post('requests/:id/verify')
  @RequirePermissions('lab_results:verify')
  verifyRequest(@Param('id') id: string, @Req() request: RequestContext) {
    return this.laboratoryService.verifyRequest(id, request);
  }

  @Post('requests/:id/cancel')
  @RequirePermissions('lab_requests:cancel')
  cancelRequest(
    @Param('id') id: string,
    @Body() dto: CancelLabRequestDto,
    @Req() request: RequestContext,
  ) {
    return this.laboratoryService.cancelRequest(id, dto, request);
  }

  @Post('results/:id/amend')
  @RequirePermissions('lab_results:amend')
  amendResult(
    @Param('id') id: string,
    @Body() dto: AmendLabResultDto,
    @Req() request: RequestContext,
  ) {
    return this.laboratoryService.amendResult(id, dto, request);
  }

  @Get('requests/:id/report')
  @RequirePermissions('lab_results:read')
  renderReport(@Param('id') id: string, @Req() request: RequestContext) {
    return this.laboratoryService.renderReport(id, request);
  }

  @Get('results/inbox')
  @RequirePermissions('lab_results:read')
  resultsInbox(@Query('patientId') patientId?: string) {
    return this.laboratoryService.resultsInbox(patientId);
  }

  @Get('results/critical')
  @RequirePermissions('lab_results:read')
  criticalResults(@Query('patientId') patientId?: string) {
    return this.laboratoryService.criticalResults(patientId);
  }

  @Post('results/:id/review')
  @RequirePermissions('lab_results:read')
  reviewResult(@Param('id') id: string, @Req() request: RequestContext) {
    return this.laboratoryService.reviewResult(id, request);
  }
}
