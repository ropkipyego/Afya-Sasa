import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InternalNotification,
  NotificationQueueEntry,
  NotificationTemplate,
  SmsLog,
} from './notification.entities';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import { StubSmsGateway } from './sms.gateway';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
    TypeOrmModule.forFeature([
      NotificationTemplate,
      NotificationQueueEntry,
      SmsLog,
      InternalNotification,
    ]),
  ],
  providers: [NotificationsService, NotificationsProcessor, StubSmsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
