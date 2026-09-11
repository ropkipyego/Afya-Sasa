import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSettings, User } from '../core/core.entities';
import { MarketingController } from './marketing.controller';
import { MarketingVisit } from './marketing.entities';
import { MarketingService } from './marketing.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantSettings, MarketingVisit, User])],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
