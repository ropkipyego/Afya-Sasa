import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class ConfigCacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly ttlSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    this.ttlSeconds = this.config.get<number>('CONFIG_CACHE_TTL_SECONDS', 300);
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.cacheKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.redis.set(this.cacheKey(key), JSON.stringify(value), 'EX', this.ttlSeconds);
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(this.cacheKey(key));
  }

  private cacheKey(key: string) {
    return `config:${key}`;
  }
}
