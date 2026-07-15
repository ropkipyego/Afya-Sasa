import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigCacheService } from './config-cache.service';

@Module({
  imports: [ConfigModule],
  providers: [ConfigCacheService],
  exports: [ConfigCacheService],
})
export class CacheModule {}
