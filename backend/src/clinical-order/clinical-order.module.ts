import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { ClinicalOrder } from './clinical-order.entities';
import { ClinicalOrderContextService } from './clinical-order-context.service';
import { ClinicalOrderMirrorService } from './clinical-order-mirror.service';
import { ClinicalOrderController } from './clinical-order.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Encounter, Admission, Patient, ClinicalOrder]),
  ],
  controllers: [ClinicalOrderController],
  providers: [ClinicalOrderContextService, ClinicalOrderMirrorService],
  exports: [ClinicalOrderContextService, ClinicalOrderMirrorService],
})
export class ClinicalOrderModule {}
