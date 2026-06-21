import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { Referral } from './referral.entities';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Referral, Patient, Encounter])],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
