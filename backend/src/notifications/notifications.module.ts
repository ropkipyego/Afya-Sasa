import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InternalNotification,
  NotificationQueueEntry,
  NotificationTemplate,
  SmsLog,
} from './notification.entities';
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
    ]),
  ],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    ConfigurableSmsGateway,
    { provide: SMS_GATEWAY, useExisting: ConfigurableSmsGateway },
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
