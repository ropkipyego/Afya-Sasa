import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/appointment.entities';
import { CriticalAlert, EmergencyEncounter } from '../emergency/emergency.entities';
import { Admission, Bed } from '../inpatient/inpatient.entities';
import { Encounter, EncounterDiagnosis } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      EncounterDiagnosis,
      Admission,
      Bed,
      EmergencyEncounter,
      CriticalAlert,
      Appointment,
    ]),
  ],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
