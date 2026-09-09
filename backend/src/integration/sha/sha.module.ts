import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient, PatientIdentifier } from '../../patients/patient.entities';
import { ShaClient } from './sha.client';
import { ShaController } from './sha.controller';
import { ShaEligibilityCheck } from './sha.entities';
import { ShaService } from './sha.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShaEligibilityCheck, Patient, PatientIdentifier])],
  controllers: [ShaController],
  providers: [ShaService, ShaClient],
  exports: [ShaService],
})
export class ShaModule {}
