import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient, PatientAllergy, PatientChronicCondition } from '../patients/patient.entities';
import { Encounter } from '../opd/opd.entities';
import { WorkflowModule } from '../workflow/workflow.module';
import { InpatientModule } from '../inpatient/inpatient.module';
import { IcuModule } from '../icu/icu.module';
import { HduModule } from '../hdu/hdu.module';
import {
  CriticalAlert,
  EmergencyEncounter,
  EmergencyNote,
  EmergencyObservationLog,
  EmergencyTreatmentBay,
} from './emergency.entities';
import { VisitQueueModule } from '../queue/visit-queue.module';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';

@Module({
  imports: [
    WorkflowModule,
    VisitQueueModule,
    InpatientModule,
    IcuModule,
    HduModule,
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
