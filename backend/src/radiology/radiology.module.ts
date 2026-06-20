import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  RadiologyAttachment,
  RadiologyModality,
  RadiologyReport,
  RadiologyRequest,
} from './radiology.entities';
import { RadiologyController } from './radiology.controller';
import { RadiologyService } from './radiology.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      Admission,
      RadiologyModality,
      RadiologyRequest,
      RadiologyReport,
      RadiologyAttachment,
    ]),
  ],
  controllers: [RadiologyController],
  providers: [RadiologyService],
})
export class RadiologyModule {}
