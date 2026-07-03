import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyEncounter } from '../emergency/emergency.entities';
import { Admission } from '../inpatient/inpatient.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient, PatientIdentifier } from '../patients/patient.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { WorklistsController } from './worklists.controller';
import { WorklistsService } from './worklists.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientIdentifier,
      Encounter,
      Admission,
      LabRequest,
      RadiologyRequest,
      EmergencyEncounter,
    ]),
  ],
  controllers: [WorklistsController],
  providers: [WorklistsService],
  exports: [WorklistsService],
})
export class WorklistsModule {}
