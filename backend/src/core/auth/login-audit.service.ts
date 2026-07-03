import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginEvent } from '../core.entities';

@Injectable()
export class LoginAuditService {
  constructor(
    @InjectRepository(LoginEvent)
    private readonly events: Repository<LoginEvent>,
  ) {}

  record(params: {
    email: string
    userId?: string | null
    eventType: LoginEvent['eventType']
    success: boolean
    failureReason?: string
    ip?: string
    userAgent?: string
    device?: string
  }) {
    return this.events.save(
      this.events.create({
        email: params.email,
        userId: params.userId ?? null,
        eventType: params.eventType,
        success: params.success,
        failureReason: params.failureReason ?? null,
        ipAddress: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        device: params.device ?? null,
      }),
    );
  }
}
