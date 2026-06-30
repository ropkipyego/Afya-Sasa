import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../core/core.entities';
import { Admission, Ward } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import {
  MedicationAdministrationRecord,
  NursingObservation,
  ShiftNote,
  VitalSigns,
} from './nursing.entities';
import { NursingController } from './nursing.controller';
import { NursingService } from './nursing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Admission,
      Encounter,
      Ward,
      VitalSigns,
      MedicationAdministrationRecord,
      ShiftNote,
      NursingObservation,
    ]),
  ],
  controllers: [NursingController],
  providers: [NursingService],
})
export class NursingModule {}
