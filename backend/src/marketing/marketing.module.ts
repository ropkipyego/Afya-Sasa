import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSettings } from '../core/core.entities';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantSettings])],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
