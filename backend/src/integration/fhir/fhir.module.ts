import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalOrder } from '../../clinical-order/clinical-order.entities';
import { Encounter } from '../../opd/opd.entities';
import { Patient, PatientIdentifier } from '../../patients/patient.entities';
import { FhirController } from './fhir.controller';
import { FhirService } from './fhir.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, PatientIdentifier, Encounter, ClinicalOrder])],
  controllers: [FhirController],
  providers: [FhirService],
})
export class FhirModule {}
