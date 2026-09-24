import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { ImportOrderableCatalogDto } from '../payments/payments.dto';
import { UpdateLabTestPricingDto } from './laboratory.dto';
import { LabCatalogService, type EvaluateLabResultsDto } from './lab-catalog.service';

@ApiBearerAuth()
@ApiTags('Laboratory Catalog')
@Controller('laboratory/catalog')
export class LabCatalogController {
  constructor(private readonly catalogService: LabCatalogService) {}

  @Get('departments')
  @RequirePermissions('lab_catalogue:read')
  listDepartments() {
    return this.catalogService.listDepartments();
  }

  @Get('specimens')
  @RequirePermissions('lab_catalogue:read')
  listSpecimens() {
    return this.catalogService.listSpecimens();
  }

  @Get('tests')
  @RequirePermissions('lab_catalogue:read', 'payments:initiate', 'lab_requests:create')
  listTests(@Query('includeParameters') includeParameters?: string, @Req() request?: RequestContext) {
    return this.catalogService.listOrderableTests(includeParameters === 'true', request);
  }

  @Get('tests/:code')
  @RequirePermissions('lab_catalogue:read', 'payments:initiate', 'lab_requests:create')
  getTest(@Param('code') code: string, @Req() request: RequestContext) {
    return this.catalogService.getOrderableTest(code, request);
  }

  @Patch('tests/:code/pricing')
  @RequirePermissions('lab_catalogue:manage', 'settings:manage')
  updatePricing(
    @Param('code') code: string,
    @Body() dto: UpdateLabTestPricingDto,
    @Req() request: RequestContext,
  ) {
    return this.catalogService.updateTestPricing(code, dto.sell, request);
  }

  @Post('evaluate')
  @RequirePermissions('lab_results:enter')
  evaluate(@Body() dto: EvaluateLabResultsDto) {
    return this.catalogService.evaluateResults(dto);
  }

  @Post('seed')
  @RequirePermissions('lab_catalogue:manage')
  seed() {
    // Explicit operator action only. Never called on application startup.
    return this.catalogService.ensureSeeded();
  }

  @Post('import')
  @RequirePermissions('lab_catalogue:manage')
  importOrderableCatalog(@Body() dto: ImportOrderableCatalogDto, @Req() request: RequestContext) {
    return this.catalogService.importOrderableCatalog(dto.csv, request);
  }

  @Post('prices/import')
  @RequirePermissions('lab_catalogue:manage', 'settings:manage')
  importPrices(@Body() dto: ImportOrderableCatalogDto, @Req() request: RequestContext) {
    return this.catalogService.importPrices(dto.csv, request);
  }
}
