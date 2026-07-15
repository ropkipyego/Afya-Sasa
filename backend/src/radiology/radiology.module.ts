import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalOrderModule } from '../clinical-order/clinical-order.module';
import { AdminModule } from '../core/admin/admin.module';
import { Admission } from '../inpatient/inpatient.entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  RadiologyAttachment,
  RadiologyModality,
  RadiologyReport,
  RadiologyRequest,
} from './radiology.entities';
import { RadiologyController } from './radiology.controller';
import { RadiologyService } from './radiology.service';

@Module({
  imports: [
    ClinicalOrderModule,
    AdminModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      Admission,
      RadiologyModality,
      RadiologyRequest,
      RadiologyReport,
      RadiologyAttachment,
    ]),
  ],
  controllers: [RadiologyController],
  providers: [RadiologyService],
})
export class RadiologyModule {}
