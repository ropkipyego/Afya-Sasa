import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/patient.entities';
import {
  ClinicalNote,
  Consultation,
  Encounter,
  EncounterAttachment,
  EncounterDiagnosis,
  SickSheet,
  TriageAssessment,
} from './opd.entities';
import { OpdController } from './opd.controller';
import { OpdService } from './opd.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      TriageAssessment,
      Consultation,
      EncounterDiagnosis,
      ClinicalNote,
      EncounterAttachment,
      SickSheet,
    ]),
  ],
  controllers: [OpdController],
  providers: [OpdService],
  exports: [OpdService],
})
export class OpdModule {}
