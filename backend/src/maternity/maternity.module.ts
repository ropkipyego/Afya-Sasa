import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient, PatientNextOfKin } from '../patients/patient.entities';
import {
  AncVisit,
  Delivery,
  LabourRecord,
  MaternityUnitAdmission,
  MotherBabyLink,
  Newborn,
  PartographEntry,
  PostnatalVisit,
  Pregnancy,
} from './maternity.entities';
import { MaternityController } from './maternity.controller';
import { MaternityService } from './maternity.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientNextOfKin,
      Encounter,
      Admission,
      Pregnancy,
      AncVisit,
      LabourRecord,
      Delivery,
      Newborn,
      PostnatalVisit,
      PartographEntry,
      MotherBabyLink,
      MaternityUnitAdmission,
    ]),
  ],
  controllers: [MaternityController],
  providers: [MaternityService],
  exports: [MaternityService],
})
export class MaternityModule {}
