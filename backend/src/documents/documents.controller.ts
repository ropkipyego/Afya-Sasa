import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { PublishHospitalDocumentDto, RegisterClinicalDocumentDto } from './documents.dto';
import { DocumentsService } from './documents.service';
import { HospitalDocumentsService } from './hospital-documents.service';

@ApiBearerAuth()
@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly hospitalDocuments: HospitalDocumentsService,
  ) {}

  @Get('hospital')
  @RequirePermissions('hospital_documents:read')
  listHospital(@Query('category') category?: string, @Query('audience') audience?: string) {
    return this.hospitalDocuments.list(category, audience);
  }

  @Post('hospital')
  @RequirePermissions('hospital_documents:create')
  publishHospital(@Body() dto: PublishHospitalDocumentDto, @Req() request: RequestContext) {
    return this.hospitalDocuments.publish(dto, request);
  }

  @Delete('hospital/:id')
  @RequirePermissions('hospital_documents:delete')
  deleteHospital(@Param('id') id: string, @Req() request: RequestContext) {
    return this.hospitalDocuments.remove(id, request);
  }

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

  @Delete(':id')
  @RequirePermissions('documents:delete')
  remove(@Param('id') id: string, @Req() request: RequestContext) {
    return this.documentsService.remove(id, request);
  }
}
