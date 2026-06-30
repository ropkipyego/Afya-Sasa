import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient, PatientAllergy, PatientChronicCondition } from '../patients/patient.entities';
import { Encounter } from '../opd/opd.entities';
import {
  CriticalAlert,
  EmergencyEncounter,
  EmergencyNote,
  EmergencyObservationLog,
  EmergencyTreatmentBay,
} from './emergency.entities';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientAllergy,
      PatientChronicCondition,
      Encounter,
      EmergencyEncounter,
      EmergencyTreatmentBay,
      EmergencyNote,
      EmergencyObservationLog,
      CriticalAlert,
    ]),
  ],
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
