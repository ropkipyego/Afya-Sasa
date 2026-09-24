import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { VisitQueueItem } from './visit-queue.entities';
import { VisitQueueController } from './visit-queue.controller';
import { VisitQueueService } from './visit-queue.service';

@Module({
  imports: [TypeOrmModule.forFeature([VisitQueueItem, Patient, Encounter])],
  controllers: [VisitQueueController],
  providers: [VisitQueueService],
  exports: [VisitQueueService],
})
export class VisitQueueModule {}
