import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSettings } from '../../core/core.entities';
import { Charge } from '../../payments/charge.entities';
import { Patient } from '../../patients/patient.entities';
import { ShaEligibilityCheck } from '../sha/sha.entities';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantSettings, Charge, Patient, ShaEligibilityCheck])],
  controllers: [InsuranceController],
  providers: [InsuranceService],
})
export class InsuranceModule {}
