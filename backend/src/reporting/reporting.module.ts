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
import { UsersModule } from '../core/users/users.module';
import { User } from '../core/core.entities';
import { ReportDelivery } from '../core/mail/mail.entities';
import { InternalNotification } from '../notifications/notification.entities';
import { Charge } from '../payments/charge.entities';
import { PaymentTransaction, QuickbooksSyncQueueItem } from '../payments/payment.entities';
import { ShaEligibilityCheck } from '../integration/sha/sha.entities';
import { InventoryBatch } from '../inventory/inventory.entities';
import { MohAutoReportService } from './moh-auto-report.service';
import { MohReportsService } from './moh-reports.service';
import { ReportingController } from './reporting.controller';
import { ReportDeliveryService } from './report-delivery.service';
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
      InternalNotification,
      Charge,
      PaymentTransaction,
      QuickbooksSyncQueueItem,
      ShaEligibilityCheck,
      InventoryBatch,
      User,
      ReportDelivery,
    ]),
    DocumentsModule,
    AdminModule,
    UsersModule,
  ],
  controllers: [ReportingController],
  providers: [ReportingService, MohReportsService, MohAutoReportService, ReportDeliveryService],
})
export class ReportingModule {}
