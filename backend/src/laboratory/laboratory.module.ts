import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  LabPanel,
  LabRequest,
  LabRequestItem,
  LabResult,
  LabSample,
  LabTest,
} from './laboratory.entities';
import { LaboratoryController } from './laboratory.controller';
import { LaboratoryService } from './laboratory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      Admission,
      LabPanel,
      LabTest,
      LabRequest,
      LabRequestItem,
      LabSample,
      LabResult,
    ]),
  ],
  controllers: [LaboratoryController],
  providers: [LaboratoryService],
})
export class LaboratoryModule {}
