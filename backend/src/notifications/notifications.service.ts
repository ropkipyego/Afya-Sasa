import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Patient } from '../patients/patient.entities';
import { NotificationQueueEntry } from './notification.entities';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationQueueEntry)
    private readonly entries: Repository<NotificationQueueEntry>,
    @InjectQueue('notifications')
    private readonly queue: Queue,
  ) {}

  async queuePatientRegistered(patient: Patient): Promise<void> {
    const entry = await this.entries.save(
      this.entries.create({
        recipient: patient.primaryPhone,
        channel: 'sms',
        content: `Welcome to AfyaSasa. Your patient number is ${patient.patientNo}.`,
      }),
    );
    await this.queue.add(
      'send-sms',
      { queueEntryId: entry.id },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 120_000 },
        priority: 5,
      },
    );
  }
}
