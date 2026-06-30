import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { ClinicalOrderContextService } from './clinical-order-context.service';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter, Admission, Patient])],
  providers: [ClinicalOrderContextService],
  exports: [ClinicalOrderContextService],
})
export class ClinicalOrderModule {}
