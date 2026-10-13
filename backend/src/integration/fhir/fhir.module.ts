import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../../opd/opd.entities';
import { Patient, PatientIdentifier } from '../../patients/patient.entities';
import { FhirController } from './fhir.controller';
import { FhirService } from './fhir.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, PatientIdentifier, Encounter])],
  controllers: [FhirController],
  providers: [FhirService],
})
export class FhirModule {}
