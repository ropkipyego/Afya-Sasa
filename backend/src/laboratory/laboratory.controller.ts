import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CollectSampleDto,
  CreateLabPanelDto,
  CreateLabRequestDto,
  CreateLabTestDto,
  EnterLabResultDto,
  ReceiveSampleDto,
} from './laboratory.dto';
import { LaboratoryService } from './laboratory.service';

@ApiBearerAuth()
@ApiTags('Laboratory')
@Controller('laboratory')
export class LaboratoryController {
  constructor(private readonly laboratoryService: LaboratoryService) {}

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
  @RequirePermissions('lab_catalogue:read')
  listTests() {
    return this.laboratoryService.listTests();
  }

  @Post('tests')
  @RequirePermissions('lab_catalogue:manage')
  createTest(@Body() dto: CreateLabTestDto, @Req() request: RequestContext) {
    return this.laboratoryService.createTest(dto, request);
  }

  @Get('requests')
  @RequirePermissions('lab_requests:read')
  listRequests(@Query('status') status?: string) {
    return this.laboratoryService.listRequests(status);
  }

  @Post('requests')
  @RequirePermissions('lab_requests:create')
  createRequest(@Body() dto: CreateLabRequestDto, @Req() request: RequestContext) {
    return this.laboratoryService.createRequest(dto, request);
  }

  @Get('requests/:id')
  @RequirePermissions('lab_requests:read')
  detail(@Param('id') id: string) {
    return this.laboratoryService.detail(id);
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

  @Post('results')
  @RequirePermissions('lab_results:enter')
  enterResult(@Body() dto: EnterLabResultDto, @Req() request: RequestContext) {
    return this.laboratoryService.enterResult(dto, request);
  }

  @Post('requests/:id/verify')
  @RequirePermissions('lab_results:verify')
  verifyRequest(@Param('id') id: string, @Req() request: RequestContext) {
    return this.laboratoryService.verifyRequest(id, request);
  }

  @Get('results/inbox')
  @RequirePermissions('lab_results:read')
  resultsInbox() {
    return this.laboratoryService.resultsInbox();
  }

  @Get('results/critical')
  @RequirePermissions('lab_results:read')
  criticalResults() {
    return this.laboratoryService.criticalResults();
  }
}
