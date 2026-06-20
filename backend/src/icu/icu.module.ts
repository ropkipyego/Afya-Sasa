import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admission, Bed } from '../inpatient/inpatient.entities';
import {
  FluidBalance,
  IcuAdmission,
  IcuObservation,
  IcuRound,
  VentilatorRecord,
} from './icu.entities';
import { IcuController } from './icu.controller';
import { IcuService } from './icu.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admission,
      Bed,
      IcuAdmission,
      IcuObservation,
      VentilatorRecord,
      FluidBalance,
      IcuRound,
    ]),
  ],
  controllers: [IcuController],
  providers: [IcuService],
})
export class IcuModule {}
