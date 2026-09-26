import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalOrderModule } from '../clinical-order/clinical-order.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { Admission } from '../inpatient/inpatient.entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { TenantSettings } from '../core/core.entities';
import {
  LabAttachment,
  LabPanel,
  LabRequest,
  LabRequestItem,
  LabResult,
  LabSample,
  LabTest,
} from './laboratory.entities';
import {
  LabDepartment,
  LabReferenceRange,
  LabTestParameter,
  OrderableLabTest,
  SpecimenType,
} from './lab-catalog.entities';
import { LaboratoryController } from './laboratory.controller';
import { LaboratoryService } from './laboratory.service';
import { LabCatalogController } from './lab-catalog.controller';
import { LabCatalogService } from './lab-catalog.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    ClinicalOrderModule,
    WorkflowModule,
    NotificationsModule,
    PaymentsModule,
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      Admission,
      LabPanel,
      LabTest,
      LabRequest,
      LabRequestItem,
      LabSample,
      LabResult,
      LabAttachment,
      LabDepartment,
      SpecimenType,
      OrderableLabTest,
      LabTestParameter,
      LabReferenceRange,
      TenantSettings,
    ]),
  ],
  controllers: [LaboratoryController, LabCatalogController],
  providers: [LaboratoryService, LabCatalogService],
  exports: [LabCatalogService],
})
export class LaboratoryModule {}
