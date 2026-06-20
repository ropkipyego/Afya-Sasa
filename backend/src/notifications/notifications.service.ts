import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../patients/patient.entities';
import { NotificationQueueEntry } from './notification.entities';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationQueueEntry)
    private readonly queue: Repository<NotificationQueueEntry>,
  ) {}

  async queuePatientRegistered(patient: Patient): Promise<void> {
    await this.queue.insert(
      this.queue.create({
        recipient: patient.primaryPhone,
        channel: 'sms',
        content: `Welcome to AfyaSasa. Your patient number is ${patient.patientNo}.`,
      }),
    );
  }
}
