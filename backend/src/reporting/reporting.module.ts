import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/appointment.entities';
import { CriticalAlert, EmergencyEncounter } from '../emergency/emergency.entities';
import { Admission, Bed } from '../inpatient/inpatient.entities';
import {
  LabRequest,
  LabRequestItem,
  LabResult,
  LabTest,
} from '../laboratory/laboratory.entities';
import { Delivery, Pregnancy } from '../maternity/maternity.entities';
import { Encounter, EncounterDiagnosis } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { Referral } from '../referrals/referral.entities';
import { SurgeryBooking } from '../theatre/theatre.entities';
import { DocumentsModule } from '../documents/documents.module';
import { AdminModule } from '../core/admin/admin.module';
import { MohReportsService } from './moh-reports.service';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      EncounterDiagnosis,
      Admission,
      Bed,
      EmergencyEncounter,
      CriticalAlert,
      Appointment,
      LabRequest,
      LabRequestItem,
      LabResult,
      LabTest,
      RadiologyRequest,
      SurgeryBooking,
      Pregnancy,
      Delivery,
      Referral,
    ]),
    DocumentsModule,
    AdminModule,
  ],
  controllers: [ReportingController],
  providers: [ReportingService, MohReportsService],
})
export class ReportingModule {}
