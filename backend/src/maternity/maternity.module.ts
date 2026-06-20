import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  AncVisit,
  Delivery,
  LabourRecord,
  Newborn,
  PostnatalVisit,
  Pregnancy,
} from './maternity.entities';
import { MaternityController } from './maternity.controller';
import { MaternityService } from './maternity.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      Admission,
      Pregnancy,
      AncVisit,
      LabourRecord,
      Delivery,
      Newborn,
      PostnatalVisit,
    ]),
  ],
  controllers: [MaternityController],
  providers: [MaternityService],
})
export class MaternityModule {}
