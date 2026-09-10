import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { Patient } from '../patients/patient.entities';
import { Encounter } from '../opd/opd.entities';
import { OpdModule } from '../opd/opd.module';
import { Clinic } from '../core/core.entities';
import { Appointment, AppointmentSlot } from './appointment.entities';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, Encounter, AppointmentSlot, Appointment, Clinic]),
    OpdModule,
    NotificationsModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
