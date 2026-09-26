import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import { TenantSettings } from '../core/core.entities';
import { Encounter } from '../opd/opd.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { Patient } from '../patients/patient.entities';
import { Admission, BedTransferLog } from '../inpatient/inpatient.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { SurgeryBooking } from '../theatre/theatre.entities';
import { BillingExceptionsService } from './billing-exceptions.service';
import { Charge } from './charge.entities';
import { PaymentTransaction, QuickbooksSyncQueueItem } from './payment.entities';
import { AccommodationChargeScheduler } from './accommodation-charge.scheduler';
import { AccommodationChargeService } from './accommodation-charge.service';
import { MpesaService } from './mpesa.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { QuickbooksWebConnectorService } from './quickbooks-webconnector.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction,
      QuickbooksSyncQueueItem,
      Charge,
      Patient,
      LabRequest,
      Encounter,
      ClinicalOrder,
      Admission,
      BedTransferLog,
      TenantSettings,
      RadiologyRequest,
      SurgeryBooking,
    ]),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    AccommodationChargeService,
    BillingExceptionsService,
    AccommodationChargeScheduler,
    MpesaService,
    QuickbooksWebConnectorService,
  ],
  exports: [PaymentsService, AccommodationChargeService, MpesaService],
})
export class PaymentsModule {}
