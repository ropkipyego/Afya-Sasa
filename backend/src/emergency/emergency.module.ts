import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { CriticalAlert, EmergencyEncounter } from './emergency.entities';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Encounter, EmergencyEncounter, CriticalAlert])],
  controllers: [EmergencyController],
  providers: [EmergencyService],
})
export class EmergencyModule {}
