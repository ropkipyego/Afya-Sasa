import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  Patient,
  PatientAllergy,
  PatientChronicCondition,
  PatientIdentifier,
  PatientNextOfKin,
} from './patient.entities';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientIdentifier,
      PatientNextOfKin,
      PatientAllergy,
      PatientChronicCondition,
    ]),
    NotificationsModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
