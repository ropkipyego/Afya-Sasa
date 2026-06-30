import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { RegisterClinicalDocumentDto } from './documents.dto';
import { DocumentsService } from './documents.service';

@ApiBearerAuth()
@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequirePermissions('documents:read')
  list(@Query('patientId') patientId: string, @Query('type') type?: string) {
    return this.documentsService.listForPatient(patientId, type);
  }

  @Get(':id')
  @RequirePermissions('documents:read')
  detail(@Param('id') id: string) {
    return this.documentsService.getOne(id);
  }

  @Post()
  @RequirePermissions('documents:create')
  register(@Body() dto: RegisterClinicalDocumentDto, @Req() request: RequestContext) {
    return this.documentsService.register(dto, request);
  }
}
