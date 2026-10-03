import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/appointment.entities';
import { AuditModule } from '../core/audit/audit.module';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient, PatientAllergy } from '../patients/patient.entities';
import { BiometricController } from './biometric.controller';
import {
  BiometricDevice,
  BiometricIdentity,
  BiometricVerification,
} from './biometric.entities';
import { BiometricService } from './biometric.service';
import { DigitalPersonaProvider } from './providers/digitalpersona.provider';

@Module({
  imports: [
    AuditModule,
    TypeOrmModule.forFeature([
      BiometricDevice,
      BiometricIdentity,
      BiometricVerification,
      Patient,
      PatientAllergy,
      Encounter,
      Admission,
      Appointment,
    ]),
  ],
  controllers: [BiometricController],
  providers: [BiometricService, DigitalPersonaProvider],
  exports: [BiometricService],
})
export class BiometricModule {}
