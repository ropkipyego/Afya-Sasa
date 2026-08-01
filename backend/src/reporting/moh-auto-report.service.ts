import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { defaultTenantCode } from '../common/tenant-defaults';
import { AdminService } from '../core/admin/admin.service';
import { InternalNotification } from '../notifications/notification.entities';
import { MohReportsService } from './moh-reports.service';

/**
 * Automates daily MOH report preparation (Nairobi timezone).
 * Notifies administrators so reports can be downloaded / submitted to KHIS.
 */
@Injectable()
export class MohAutoReportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MohAutoReportService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunKey: string | null = null;

  constructor(
    private readonly mohReports: MohReportsService,
    private readonly adminService: AdminService,
    @InjectRepository(InternalNotification)
    private readonly notifications: Repository<InternalNotification>,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.maybeRunDaily();
    }, 60 * 60 * 1000);
    setTimeout(() => void this.maybeRunDaily(), 20_000);
    this.logger.log('MOH auto-report scheduler started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private nairobiNow() {
    return new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
    );
  }

  async maybeRunDaily() {
    const now = this.nairobiNow();
    if (now.getHours() < 18) return;

    const runKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (this.lastRunKey === runKey) return;

    try {
      await this.runForCurrentMonth(now);
      this.lastRunKey = runKey;
      this.logger.log(`MOH auto-report completed for ${runKey}`);
    } catch (error) {
      this.logger.error(
        `MOH auto-report failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async runForCurrentMonth(reference = this.nairobiNow()) {
    const period = {
      year: reference.getFullYear(),
      month: reference.getMonth() + 1,
    };
    const facility = await this.adminService.resolveFacilityContext(defaultTenantCode());

    const [moh705a, moh705b, moh706, moh717] = await Promise.all([
      this.mohReports.moh705a(period, facility),
      this.mohReports.moh705b(period, facility),
      this.mohReports.moh706(period, facility),
      this.mohReports.moh717(period, facility),
    ]);

    const body = [
      `Auto-prepared MOH pack for ${period.month}/${period.year} (Africa/Nairobi schedule).`,
      `705A lines: ${Array.isArray((moh705a as { lines?: unknown[] }).lines) ? (moh705a as { lines: unknown[] }).lines.length : 'ok'}.`,
      `705B lines: ${Array.isArray((moh705b as { lines?: unknown[] }).lines) ? (moh705b as { lines: unknown[] }).lines.length : 'ok'}.`,
      `706/717 generated.`,
      `Open Clinical Reports to download and submit to KHIS.`,
      `706 status: ${moh706 ? 'ok' : 'n/a'}; 717 status: ${moh717 ? 'ok' : 'n/a'}.`,
    ].join(' ');

    const admins = await this.adminService.listActiveAdministrators();

    for (const admin of admins) {
      await this.notifications.save(
        this.notifications.create({
          recipientId: admin.id,
          title: 'MOH reports ready (auto)',
          body,
          severity: 'info',
          link: '/reports',
          createdBy: null,
          updatedBy: null,
        }),
      );
    }

    return {
      ok: true,
      period,
      facility,
      notifiedAdmins: admins.length,
      generatedAt: new Date().toISOString(),
    };
  }
}
