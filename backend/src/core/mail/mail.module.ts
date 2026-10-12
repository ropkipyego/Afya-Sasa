import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailController } from './mail.controller';
import { TenantSettings } from '../core.entities';
import { EmailDelivery, ReportDelivery } from './mail.entities';
import { MailOverlayStore } from './mail.overlay';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([EmailDelivery, ReportDelivery, TenantSettings])],
  controllers: [MailController],
  providers: [MailService, MailOverlayStore],
  exports: [MailService, MailOverlayStore, TypeOrmModule],
})
export class MailModule {}
