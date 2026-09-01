import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { Role, User, UserRole } from '../core/core.entities';
import { Patient } from '../patients/patient.entities';
import { WorkflowModule } from '../workflow/workflow.module';
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
      User,
      Role,
      UserRole,
      Encounter,
      TriageAssessment,
      Consultation,
      EncounterDiagnosis,
      ClinicalNote,
      EncounterAttachment,
      SickSheet,
    ]),
    WorkflowModule,
    NotificationsModule,
  ],
  controllers: [OpdController],
  providers: [OpdService],
  exports: [OpdService],
})
export class OpdModule {}
