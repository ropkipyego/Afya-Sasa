import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  Admission,
  Bed,
  BedTransferLog,
  DailyProgressNote,
  DischargeSummary,
  Ward,
} from './inpatient.entities';
import { InpatientController } from './inpatient.controller';
import { InpatientService } from './inpatient.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      Ward,
      Bed,
      Admission,
      BedTransferLog,
      DailyProgressNote,
      DischargeSummary,
    ]),
  ],
  controllers: [InpatientController],
  providers: [InpatientService],
  exports: [InpatientService],
})
export class InpatientModule {}
