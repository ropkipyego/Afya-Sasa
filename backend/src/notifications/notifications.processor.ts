import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { NotificationQueueEntry, SmsLog } from './notification.entities';
import { StubSmsGateway } from './sms.gateway';

interface SendNotificationJob {
  queueEntryId: string;
}

@Injectable()
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(
    @InjectRepository(NotificationQueueEntry)
    private readonly entries: Repository<NotificationQueueEntry>,
    @InjectRepository(SmsLog)
    private readonly smsLogs: Repository<SmsLog>,
    private readonly smsGateway: StubSmsGateway,
  ) {
    super();
  }

  async process(job: Job<SendNotificationJob>): Promise<void> {
    const entry = await this.entries.findOne({
      where: { id: job.data.queueEntryId },
    });

    if (!entry || entry.sentAt) {
      return;
    }

    if (entry.channel !== 'sms') {
      await this.entries.update(entry.id, {
        attempts: entry.attempts + 1,
        lastAttemptAt: new Date(),
        error: 'Only SMS delivery is implemented in Phase 1',
      });
      return;
    }

    try {
      const result = await this.smsGateway.sendSms(
        entry.recipient,
        entry.content,
      );
      await this.smsLogs.save(
        this.smsLogs.create({
          queueEntry: entry,
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          destination: entry.recipient,
          text: entry.content,
          deliveryStatus: result.status,
          cost: result.cost,
          sentAt: new Date(),
        }),
      );
      await this.entries.update(entry.id, {
        attempts: entry.attempts + 1,
        lastAttemptAt: new Date(),
        sentAt: new Date(),
        error: null,
      });
    } catch (error) {
      await this.entries.update(entry.id, {
        attempts: entry.attempts + 1,
        lastAttemptAt: new Date(),
        error: error instanceof Error ? error.message : 'SMS delivery failed',
      });
      throw error;
    }
  }
}
