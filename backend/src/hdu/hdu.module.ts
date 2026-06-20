import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admission, Bed } from '../inpatient/inpatient.entities';
import { HduAdmission, HduObservation, HduRound } from './hdu.entities';
import { HduController } from './hdu.controller';
import { HduService } from './hdu.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admission,
      Bed,
      HduAdmission,
      HduObservation,
      HduRound,
    ]),
  ],
  controllers: [HduController],
  providers: [HduService],
})
export class HduModule {}
