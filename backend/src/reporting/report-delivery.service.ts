import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import type { AuthenticatedUserContext } from '../common/request-context';
import { User } from '../core/core.entities';
import { MailService } from '../core/mail/mail.service';
import { ReportDelivery } from '../core/mail/mail.entities';
import { UsersService } from '../core/users/users.service';
import { ReportingService } from './reporting.service';
import type { DeliverGovernmentNotificationDto, DeliverInternalReportDto } from './report-delivery.dto';

const GENERIC_GOVERNMENT_FAILURE =
  'Government notification was not delivered. This is not a submission acknowledgement.';

@Injectable()
export class ReportDeliveryService {
  constructor(
    private readonly reports: ReportingService,
    private readonly mail: MailService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRows: Repository<User>,
    @InjectRepository(ReportDelivery)
    private readonly deliveries: Repository<ReportDelivery>,
  ) {}

  async deliverInternal(dto: DeliverInternalReportDto, actor: AuthenticatedUserContext) {
    if (!actor.permissions?.includes('reports:read')) {
      throw new ForbiddenException('Permission denied');
    }
    if (dto.exportScope && dto.exportScope !== 'aggregate') {
      throw new ForbiddenException('Patient-level report email is not permitted');
    }
    this.assertDateRange(dto.from, dto.to);
    const recipient = await this.userRows.findOne({ where: { id: dto.recipientUserId } });
    if (!recipient?.active) {
      throw new BadRequestException('Recipient is not an active hospital user');
    }
    const recipientAuth = await this.users.collectRolesAndPermissions(recipient.id);
    if (!recipientAuth.permissions.includes('reports:read')) {
      throw new ForbiddenException('Recipient is not approved for internal reports');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const row = await this.deliveries.save(
      this.deliveries.create({
        workflow: 'internal',
        reportType: dto.reportType,
        exportScope: 'aggregate',
        dateFrom: dto.from,
        dateTo: dto.to,
        requesterUserId: actor.sub,
        recipientUserId: recipient.id,
        recipientFingerprint: this.hash(recipient.email.toLowerCase()),
        tokenHash: this.hash(rawToken),
        expiresAt,
        status: 'pending',
        createdBy: actor.sub,
      }),
    );

    const origin = this.mail.runtimeConfig().publicOrigin ?? '';
    const viewUrl = `${origin.replace(/\/$/, '')}/api/v1/reports/shared/${rawToken}`;
    const mailed = await this.mail.sendInternalReportNotice({
      to: recipient.email,
      reportType: dto.reportType,
      rangeLabel: `${dto.from} to ${dto.to}`,
      viewUrl,
      requesterEmail: actor.email,
      idempotencyKey: `internal_report:${row.id}`,
      createdBy: actor.sub,
    });

    await this.deliveries.update(row.id, {
      status: mailed.accepted ? 'notified' : mailed.status,
      emailDeliveryId: mailed.deliveryId ?? null,
    });

    return {
      id: row.id,
      workflow: 'internal' as const,
      accepted: mailed.accepted,
      status: mailed.status,
      expiresAt: expiresAt.toISOString(),
      reason: mailed.reason,
    };
  }

  async deliverGovernmentNotification(
    dto: DeliverGovernmentNotificationDto,
    actor: AuthenticatedUserContext,
  ) {
    if (!actor.permissions?.includes('reports:government_notify')) {
      throw new ForbiddenException('Government notification permission required');
    }
    const allowlist = (this.config.get<string>('EMAIL_GOVERNMENT_NOTIFY_ALLOWLIST') ?? '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    const recipient = dto.recipientEmail.trim().toLowerCase();
    if (!allowlist.includes(recipient)) {
      throw new ForbiddenException('Recipient is not on the government notification allowlist');
    }
    if (/patient|encounter|diagnosis|lab result/i.test(dto.detail)) {
      throw new BadRequestException('Government email must not include clinical patient details');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const row = await this.deliveries.save(
      this.deliveries.create({
        workflow: 'government',
        reportType: `government_${dto.kind}`,
        exportScope: 'aggregate',
        dateFrom: null,
        dateTo: null,
        requesterUserId: actor.sub,
        recipientUserId: null,
        recipientFingerprint: this.hash(recipient),
        tokenHash: this.hash(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        status: 'pending',
        createdBy: actor.sub,
      }),
    );

    const mailed = await this.mail.sendGovernmentNotification({
      to: recipient,
      kind: dto.kind,
      integration: dto.integration,
      detail: dto.detail,
      idempotencyKey: `government:${row.id}`,
    });

    await this.deliveries.update(row.id, {
      status: mailed.accepted ? 'notified' : mailed.status,
      emailDeliveryId: mailed.deliveryId ?? null,
    });

    return {
      id: row.id,
      workflow: 'government' as const,
      accepted: mailed.accepted,
      status: mailed.status,
      acknowledgement: false,
      message: mailed.accepted
        ? 'Notification queued with the mail provider. This is not a statutory submission receipt.'
        : GENERIC_GOVERNMENT_FAILURE,
      reason: mailed.reason,
    };
  }

  async openShared(rawToken: string, actor: AuthenticatedUserContext) {
    const row = await this.deliveries.findOne({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!row) throw new NotFoundException('Report link is invalid');
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Report link has expired');
    }
    if (row.workflow !== 'internal') {
      throw new ForbiddenException('Government workflows are not opened as report exports');
    }
    if (!actor?.permissions?.includes('reports:read')) {
      throw new ForbiddenException('Sign in with an approved reports account to open this link');
    }
    if (row.recipientUserId && row.recipientUserId !== actor.sub && !actor.permissions.includes('audit_logs:read')) {
      throw new ForbiddenException('This report link was issued to a different recipient');
    }

    const payload = await this.loadAggregate(row.reportType, row.dateFrom ?? undefined, row.dateTo ?? undefined, actor);
    row.consumedAt = row.consumedAt ?? new Date();
    await this.deliveries.save(row);
    return {
      reportType: row.reportType,
      from: row.dateFrom,
      to: row.dateTo,
      exportScope: row.exportScope,
      generatedAt: new Date().toISOString(),
      data: payload,
    };
  }

  private async loadAggregate(
    reportType: string,
    from: string | undefined,
    to: string | undefined,
    actor: AuthenticatedUserContext,
  ) {
    if (reportType === 'dashboard') return this.reports.dashboard();
    if (reportType === 'operations') return this.reports.operationsCommandCenter(actor);
    if (reportType === 'intelligence') {
      return this.reports.intelligence(from ?? this.defaultFrom(), to ?? this.defaultTo(), actor);
    }
    if (reportType === 'executive-analytics') {
      return this.reports.executiveAnalytics(from ?? this.defaultFrom(), to ?? this.defaultTo(), actor);
    }
    throw new BadRequestException('Unsupported report type');
  }

  private assertDateRange(from: string, to: string) {
    if (from > to) throw new BadRequestException('Invalid report date range');
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new BadRequestException('Invalid report date range');
    }
    if (end - start > 92 * 86_400_000) {
      throw new BadRequestException('Report range cannot exceed 92 days');
    }
  }

  private defaultTo() {
    return new Date().toISOString().slice(0, 10);
  }

  private defaultFrom() {
    return new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
