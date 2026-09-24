import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { inactivityTimeoutSeconds } from './session-policy';

@Injectable()
export class TokenRevocationService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  async invalidateUser(userId: string): Promise<void> {
    const key = this.userKey(userId);
    await this.redis.set(key, String(Date.now()), 'EX', 8 * 24 * 60 * 60);
  }

  async invalidateUsers(userIds: string[]): Promise<void> {
    await Promise.all(userIds.map((id) => this.invalidateUser(id)));
  }

  async isAccessTokenRevoked(userId: string, issuedAtSeconds: number): Promise<boolean> {
    const invalidatedAt = await this.redis.get(this.userKey(userId));
    if (!invalidatedAt) return false;
    return issuedAtSeconds * 1000 < Number(invalidatedAt);
  }

  async touchSessionActivity(sessionId: string): Promise<void> {
    const ttl = Math.max(inactivityTimeoutSeconds() * 2, 300);
    await this.redis.set(this.activityKey(sessionId), String(Date.now()), 'EX', ttl);
  }

  async clearSessionActivity(sessionId: string): Promise<void> {
    await this.redis.del(this.activityKey(sessionId));
  }

  async isSessionInactive(sessionId: string | undefined, issuedAtSeconds?: number): Promise<boolean> {
    if (!sessionId) {
      if (!issuedAtSeconds) return false;
      return Date.now() - issuedAtSeconds * 1000 > inactivityTimeoutSeconds() * 1000;
    }
    try {
      const lastSeen = await this.redis.get(this.activityKey(sessionId));
      if (!lastSeen) {
        await this.touchSessionActivity(sessionId);
        return false;
      }
      return Date.now() - Number(lastSeen) > inactivityTimeoutSeconds() * 1000;
    } catch {
      return false;
    }
  }

  private userKey(userId: string) {
    return `auth:invalidate:${userId}`;
  }

  private activityKey(sessionId: string) {
    return `auth:activity:${sessionId}`;
  }
}
