import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateMarketingActivityDto,
  CreateMarketingVisitDto,
  ImportMarketingCatalogDto,
  ListMarketingActivitiesQuery,
  UpdateMarketingActivityDto,
} from './marketing.dto';
import { MarketingService } from './marketing.service';

@ApiBearerAuth()
@ApiTags('Marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('catalog')
  @RequirePermissions('marketing:read', 'settings:manage')
  catalog(@Req() request: RequestContext) {
    return this.marketing.getCatalog(request);
  }

  @Post('catalog/import')
  @RequirePermissions('marketing:manage', 'settings:manage')
  importCatalog(@Body() dto: ImportMarketingCatalogDto, @Req() request: RequestContext) {
    return this.marketing.importCatalog(dto, request);
  }

  @Get('activities')
  @RequirePermissions('marketing:read')
  listActivities(@Query() query: ListMarketingActivitiesQuery, @Req() request: RequestContext) {
    return this.marketing.listActivities(query, request);
  }

  @Get('activities/:id')
  @RequirePermissions('marketing:read')
  getActivity(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestContext) {
    return this.marketing.getActivity(id, request);
  }

  @Post('activities')
  @RequirePermissions('marketing:create')
  createActivity(@Body() dto: CreateMarketingActivityDto, @Req() request: RequestContext) {
    return this.marketing.createActivity(dto, request);
  }

  @Patch('activities/:id')
  @RequirePermissions('marketing:update', 'marketing:manage')
  updateActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMarketingActivityDto,
    @Req() request: RequestContext,
  ) {
    return this.marketing.updateActivity(id, dto, request);
  }

  @Delete('activities/:id')
  @RequirePermissions('marketing:delete', 'marketing:manage')
  deleteActivity(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestContext) {
    return this.marketing.deleteActivity(id, request);
  }

  @Get('dashboard')
  @RequirePermissions('marketing:read')
  dashboard(@Query('staffId') staffId: string | undefined, @Req() request: RequestContext) {
    return this.marketing.getDashboard(request, staffId);
  }

  @Get('reports/summary')
  @RequirePermissions('marketing:reports', 'marketing:manage')
  teamSummary(@Query() query: ListMarketingActivitiesQuery, @Req() request: RequestContext) {
    return this.marketing.getTeamSummary(query, request);
  }

  @Get('visits')
  @RequirePermissions('marketing:read')
  listVisits(@Req() request: RequestContext) {
    return this.marketing.listLegacyVisits(request);
  }

  @Post('visits')
  @RequirePermissions('marketing:create')
  createVisit(@Body() dto: CreateMarketingVisitDto, @Req() request: RequestContext) {
    return this.marketing.createLegacyVisit(dto, request);
  }
}
