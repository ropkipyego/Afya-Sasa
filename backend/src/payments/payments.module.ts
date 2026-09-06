import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../opd/opd.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { Patient } from '../patients/patient.entities';
import { PaymentTransaction, QuickbooksSyncQueueItem } from './payment.entities';
import { MpesaService } from './mpesa.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { QuickbooksWebConnectorService } from './quickbooks-webconnector.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction,
      QuickbooksSyncQueueItem,
      Patient,
      LabRequest,
      Encounter,
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, MpesaService, QuickbooksWebConnectorService],
  exports: [PaymentsService, MpesaService],
})
export class PaymentsModule {}
