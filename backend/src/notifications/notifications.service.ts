import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { Patient } from '../patients/patient.entities';
import { RealtimeService } from '../realtime/realtime.service';
import { InternalNotification, NotificationQueueEntry, NotificationTemplate, SmsLog } from './notification.entities';
import { SMS_GATEWAY } from './sms.gateway';
import type { SmsGateway } from './sms.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationQueueEntry)
    private readonly entries: Repository<NotificationQueueEntry>,
    @InjectRepository(InternalNotification)
    private readonly internal: Repository<InternalNotification>,
    @InjectRepository(NotificationTemplate)
    private readonly templates: Repository<NotificationTemplate>,
    @InjectQueue('notifications')
    private readonly queue: Queue,
    private readonly realtime: RealtimeService,
    @InjectRepository(SmsLog)
    private readonly smsLogs: Repository<SmsLog>,
    @Inject(SMS_GATEWAY)
    private readonly smsGateway: SmsGateway,
  ) {}

  async queuePatientRegistered(patient: Patient): Promise<void> {
    const entry = await this.entries.save(
      this.entries.create({
        recipient: patient.primaryPhone,
        channel: 'sms',
        content: `Welcome to Jalaram Hospital. Your patient number is ${patient.patientNo}.`,
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

  listTemplates() {
    return this.templates.find({ order: { key: 'ASC' } });
  }

  async createInternal(input: {
    recipientId: string;
    title: string;
    body: string;
    severity?: 'info' | 'warning' | 'critical';
    link?: string | null;
    createdBy?: string | null;
  }) {
    return this.internal.save(
      this.internal.create({
        recipientId: input.recipientId,
        title: input.title,
        body: input.body,
        severity: input.severity ?? 'info',
        link: input.link ?? null,
        createdBy: input.createdBy ?? null,
        updatedBy: input.createdBy ?? null,
      }),
    );
  }

  listInbox(recipientId: string, unreadOnly = false) {
    return this.internal.find({
      where: unreadOnly ? { recipientId, readAt: IsNull() } : { recipientId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async inboxSummary(recipientId: string) {
    const [unread, total] = await Promise.all([
      this.internal.count({ where: { recipientId, readAt: IsNull() } }),
      this.internal.count({ where: { recipientId } }),
    ]);
    return { unread, total };
  }

  async markRead(id: string, recipientId: string) {
    const item = await this.internal.findOne({ where: { id, recipientId } });
    if (!item) throw new NotFoundException('Notification not found');
    item.readAt = new Date();
    return this.internal.save(item);
  }

  async markAllRead(recipientId: string) {
    await this.internal.update(
      { recipientId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { ok: true };
  }

  async notifyUsers(
    recipientIds: Array<string | null | undefined>,
    input: {
      title: string;
      body: string;
      severity?: 'info' | 'warning' | 'critical';
      link?: string | null;
      createdBy?: string | null;
      tenantCode?: string;
    },
  ) {
    const unique = [...new Set(recipientIds.filter((id): id is string => Boolean(id)))];
    await Promise.all(
      unique.map((recipientId) =>
        this.createInternal({
          recipientId,
          title: input.title,
          body: input.body,
          severity: input.severity ?? 'info',
          link: input.link ?? null,
          createdBy: input.createdBy ?? null,
        }),
      ),
    );
    this.realtime.publish(input.tenantCode ?? 'demo', 'notification.created', {
      recipients: unique.length,
    });
  }

  async notifyInvestigationStakeholders(
    stakeholderIds: Array<string | null | undefined>,
    input: {
      title: string;
      body: string;
      severity?: 'info' | 'warning' | 'critical';
      link?: string | null;
      actorId?: string | null;
    },
  ) {
    await this.notifyUsers(stakeholderIds, {
      title: input.title,
      body: input.body,
      severity: input.severity ?? 'info',
      link: input.link,
      createdBy: input.actorId ?? null,
    });
  }

  investigationRecipients(input: {
    createdBy?: string | null;
    attendingDoctorId?: string | null;
    admittingDoctorId?: string | null;
  }) {
    return [input.createdBy, input.attendingDoctorId, input.admittingDoctorId];
  }

  /** Immediate single or bulk SMS via configured provider (Celcom Africa, etc.). */
  async sendBulkSms(input: {
    mobiles: string[];
    message: string;
    createdBy?: string | null;
  }) {
    const mobiles = [...new Set(input.mobiles.map((m) => m.trim()).filter(Boolean))];
    if (!mobiles.length) {
      throw new BadRequestException('Provide at least one mobile number');
    }
    const message = input.message.trim();
    if (!message) {
      throw new BadRequestException('Message text is required');
    }

    const result = this.smsGateway.sendBulkSms
      ? await this.smsGateway.sendBulkSms(mobiles, message)
      : await this.smsGateway.sendSms(mobiles.join(','), message);

    await Promise.all(
      mobiles.map((mobile) =>
        this.smsLogs.save(
          this.smsLogs.create({
            destination: mobile,
            text: message,
            provider: result.provider,
            providerMessageId: result.providerMessageId,
            deliveryStatus: result.status,
            cost: result.cost,
            sentAt: new Date(),
            createdBy: input.createdBy ?? null,
            updatedBy: input.createdBy ?? null,
          }),
        ),
      ),
    );

    return {
      ok: true,
      provider: result.provider,
      recipients: result.recipients ?? mobiles.length,
      providerMessageId: result.providerMessageId,
      status: result.status,
    };
  }

  listRecentSmsLogs(limit = 50) {
    return this.smsLogs.find({
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }
}
