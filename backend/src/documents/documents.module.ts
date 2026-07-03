import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/patient.entities';
import { StorageModule } from '../storage/storage.module';
import { ClinicalDocument } from './clinical-document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { HospitalDocument } from './hospital-document.entity';
import { HospitalDocumentsService } from './hospital-documents.service';
import { TemplateRenderService } from './template-render.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClinicalDocument, HospitalDocument, Patient]), StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, HospitalDocumentsService, TemplateRenderService],
  exports: [DocumentsService, HospitalDocumentsService, TemplateRenderService],
})
export class DocumentsModule {}
