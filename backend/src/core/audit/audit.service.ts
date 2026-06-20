import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../core.entities';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async record(entry: Partial<AuditLog>): Promise<void> {
    try {
      await this.auditLogs.insert(this.auditLogs.create(entry));
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
    }
  }
}
