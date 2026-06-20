import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateAncVisitDto,
  CreateDeliveryDto,
  CreateLabourRecordDto,
  CreateNewbornDto,
  CreatePostnatalVisitDto,
  RegisterPregnancyDto,
} from './maternity.dto';
import { MaternityService } from './maternity.service';

@ApiBearerAuth()
@ApiTags('Maternity')
@Controller('maternity')
export class MaternityController {
  constructor(private readonly maternityService: MaternityService) {}

  @Get('pregnancies')
  @RequirePermissions('pregnancies:read')
  listPregnancies(@Query('patientId') patientId?: string) {
    return this.maternityService.listPregnancies(patientId);
  }

  @Post('pregnancies')
  @RequirePermissions('pregnancies:create')
  registerPregnancy(@Body() dto: RegisterPregnancyDto, @Req() request: RequestContext) {
    return this.maternityService.registerPregnancy(dto, request);
  }

  @Get('pregnancies/:id')
  @RequirePermissions('pregnancies:read')
  detail(@Param('id') id: string) {
    return this.maternityService.detail(id);
  }

  @Post('pregnancies/:id/anc-visits')
  @RequirePermissions('anc_visits:create')
  createAncVisit(@Param('id') id: string, @Body() dto: CreateAncVisitDto, @Req() request: RequestContext) {
    return this.maternityService.createAncVisit(id, dto, request);
  }

  @Post('pregnancies/:id/labour-records')
  @RequirePermissions('labour_records:create')
  createLabourRecord(@Param('id') id: string, @Body() dto: CreateLabourRecordDto, @Req() request: RequestContext) {
    return this.maternityService.createLabourRecord(id, dto, request);
  }

  @Post('pregnancies/:id/deliveries')
  @RequirePermissions('deliveries:create')
  createDelivery(@Param('id') id: string, @Body() dto: CreateDeliveryDto, @Req() request: RequestContext) {
    return this.maternityService.createDelivery(id, dto, request);
  }

  @Post('deliveries/:id/newborns')
  @RequirePermissions('newborns:create')
  createNewborn(@Param('id') id: string, @Body() dto: CreateNewbornDto, @Req() request: RequestContext) {
    return this.maternityService.createNewborn(id, dto, request);
  }

  @Post('pregnancies/:id/postnatal-visits')
  @RequirePermissions('postnatal_visits:create')
  createPostnatalVisit(@Param('id') id: string, @Body() dto: CreatePostnatalVisitDto, @Req() request: RequestContext) {
    return this.maternityService.createPostnatalVisit(id, dto, request);
  }
}
