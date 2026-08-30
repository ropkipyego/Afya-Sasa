import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalOrderModule } from '../clinical-order/clinical-order.module';
import { ClinicalOrder } from '../clinical-order/clinical-order.entities';
import {
  InventoryBatch,
  InventoryItem,
  InventoryLocation,
  InventoryRequisition,
  InventoryRequisitionLine,
  InventoryTransfer,
  InventoryTransferLine,
  InventoryTransaction,
} from './inventory.entities';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    ClinicalOrderModule,
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryLocation,
      InventoryBatch,
      InventoryTransaction,
      InventoryRequisition,
      InventoryRequisitionLine,
      InventoryTransfer,
      InventoryTransferLine,
      ClinicalOrder,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
