import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { Role, User, UserRole } from '../core/core.entities';
import { Patient } from '../patients/patient.entities';
import { Appointment } from '../appointments/appointment.entities';
import { WorkflowModule } from '../workflow/workflow.module';
import { VisitQueueModule } from '../queue/visit-queue.module';
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
      Appointment,
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
    VisitQueueModule,
  ],
  controllers: [OpdController],
  providers: [OpdService],
  exports: [OpdService],
})
export class OpdModule {}
