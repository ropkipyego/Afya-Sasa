import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEvent } from './notification-event.entity';

@Injectable()
export class NotificationDispatcherService {
  constructor(
    @InjectRepository(NotificationEvent)
    private readonly events: Repository<NotificationEvent>,
  ) {}

  async enqueue(params: {
    eventType: string;
    recipientUserId?: string;
    patientId?: string;
    channel?: 'in_app' | 'email' | 'sms';
    payload?: Record<string, unknown>;
    scheduledAt?: Date;
  }) {
    return this.events.save(
      this.events.create({
        eventType: params.eventType,
        channel: params.channel ?? 'in_app',
        recipientUserId: params.recipientUserId ?? null,
        patientId: params.patientId ?? null,
        payload: params.payload ?? {},
        status: 'pending',
        scheduledAt: params.scheduledAt ?? new Date(),
        deliveredAt: null,
      }),
    );
  }

  async listPending(limit = 100) {
    return this.events.find({
      where: { status: 'pending' },
      order: { scheduledAt: 'ASC' },
      take: limit,
    });
  }

  async markDelivered(id: string) {
    await this.events.update(id, {
      status: 'delivered',
      deliveredAt: new Date(),
    });
  }
}
