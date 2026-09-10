import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { CreateMarketingVisitDto, ImportMarketingCatalogDto } from './marketing.dto';
import { MarketingService } from './marketing.service';

@ApiBearerAuth()
@ApiTags('Marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('catalog')
  @RequirePermissions('appointments:read')
  catalog(@Req() request: RequestContext) {
    return this.marketing.getCatalog(request);
  }

  @Post('catalog/import')
  @RequirePermissions('appointments:read', 'settings:manage')
  importCatalog(@Body() dto: ImportMarketingCatalogDto, @Req() request: RequestContext) {
    return this.marketing.importCatalog(dto, request);
  }

  @Get('visits')
  @RequirePermissions('appointments:read')
  list(@Req() request: RequestContext) {
    return this.marketing.listVisits(request);
  }

  @Post('visits')
  @RequirePermissions('appointments:read')
  create(@Body() dto: CreateMarketingVisitDto, @Req() request: RequestContext) {
    return this.marketing.createVisit(dto, request);
  }
}
