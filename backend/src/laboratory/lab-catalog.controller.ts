import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../core/auth/auth.decorators';
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
  @RequirePermissions('lab_catalogue:read')
  listTests(@Query('includeParameters') includeParameters?: string) {
    return this.catalogService.listOrderableTests(includeParameters === 'true');
  }

  @Get('tests/:code')
  @RequirePermissions('lab_catalogue:read')
  getTest(@Param('code') code: string) {
    return this.catalogService.getOrderableTest(code);
  }

  @Post('evaluate')
  @RequirePermissions('lab_results:enter')
  evaluate(@Body() dto: EvaluateLabResultsDto) {
    return this.catalogService.evaluateResults(dto);
  }

  @Post('seed')
  @RequirePermissions('lab_catalogue:manage')
  seed() {
    return this.catalogService.ensureSeeded();
  }
}
