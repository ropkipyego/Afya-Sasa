import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InternalNotification,
  NotificationQueueEntry,
  NotificationTemplate,
  SmsLog,
} from './notification.entities';
import { NotificationEvent } from './notification-event.entity';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import { ConfigurableSmsGateway, SMS_GATEWAY } from './sms.gateway';

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
      NotificationEvent,
    ]),
  ],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    NotificationDispatcherService,
    ConfigurableSmsGateway,
    { provide: SMS_GATEWAY, useExisting: ConfigurableSmsGateway },
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationDispatcherService],
})
export class NotificationsModule {}
