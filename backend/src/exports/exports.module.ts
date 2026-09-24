import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import { EmergencyEncounter } from '../emergency/emergency.entities';
import { HduAdmission } from '../hdu/hdu.entities';
import { IcuAdmission } from '../icu/icu.entities';
import { Admission } from '../inpatient/inpatient.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { Pregnancy } from '../maternity/maternity.entities';
import { VitalSigns } from '../nursing/nursing.entities';
import { Encounter } from '../opd/opd.entities';
import { Charge } from '../payments/charge.entities';
import { PaymentTransaction } from '../payments/payment.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { SurgeryBooking } from '../theatre/theatre.entities';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Encounter,
      LabRequest,
      RadiologyRequest,
      ClinicalOrder,
      Admission,
      EmergencyEncounter,
      PaymentTransaction,
      Charge,
      SurgeryBooking,
      Pregnancy,
      IcuAdmission,
      HduAdmission,
      VitalSigns,
    ]),
  ],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
