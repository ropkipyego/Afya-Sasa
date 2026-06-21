import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { Appointment } from '../appointments/appointment.entities';
import { HduAdmission } from '../hdu/hdu.entities';
import { IcuAdmission } from '../icu/icu.entities';
import { Admission } from '../inpatient/inpatient.entities';
import { LabResult } from '../laboratory/laboratory.entities';
import { Pregnancy } from '../maternity/maternity.entities';
import { Encounter } from '../opd/opd.entities';
import { RadiologyReport } from '../radiology/radiology.entities';
import { Referral } from '../referrals/referral.entities';
import { SurgeryBooking } from '../theatre/theatre.entities';
import {
  Patient,
  PatientAllergy,
  PatientChronicCondition,
  PatientIdentifier,
  PatientNextOfKin,
} from './patient.entities';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientIdentifier,
      PatientNextOfKin,
      PatientAllergy,
      PatientChronicCondition,
      Encounter,
      Admission,
      LabResult,
      RadiologyReport,
      SurgeryBooking,
      Pregnancy,
      IcuAdmission,
      HduAdmission,
      Appointment,
      Referral,
    ]),
    NotificationsModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
