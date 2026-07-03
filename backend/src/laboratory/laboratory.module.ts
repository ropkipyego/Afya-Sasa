import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalOrderModule } from '../clinical-order/clinical-order.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { Admission } from '../inpatient/inpatient.entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  LabAttachment,
  LabPanel,
  LabRequest,
  LabRequestItem,
  LabResult,
  LabSample,
  LabTest,
} from './laboratory.entities';
import { LaboratoryController } from './laboratory.controller';
import { LaboratoryService } from './laboratory.service';

@Module({
  imports: [
    ClinicalOrderModule,
    WorkflowModule,
    NotificationsModule,
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
    ]),
  ],
  controllers: [LaboratoryController],
  providers: [LaboratoryService],
})
export class LaboratoryModule {}
