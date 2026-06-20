import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  SurgicalProcedure,
  SurgeryBooking,
  SurgeryComplication,
  SurgeryNote,
  SurgeryStaff,
  Theatre,
} from './theatre.entities';
import { TheatreController } from './theatre.controller';
import { TheatreService } from './theatre.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      Admission,
      Theatre,
      SurgicalProcedure,
      SurgeryBooking,
      SurgeryStaff,
      SurgeryNote,
      SurgeryComplication,
    ]),
  ],
  controllers: [TheatreController],
  providers: [TheatreService],
})
export class TheatreModule {}
