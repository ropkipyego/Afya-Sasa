import { Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../../common/request-context';
import { RequirePermissions } from '../auth/auth.decorators';
import { TenantSettings } from '../core.entities';
import { EmailDelivery } from './mail.entities';
import { MailOverlayStore } from './mail.overlay';
import { isValidEmailAddress, parseMailOverlay, type MailOverlay } from './mail.policy';
import { MailService } from './mail.service';

type PolicyPatch = {
  operatorDeliveryRequested?: boolean;
  recipientAllowlist?: string[];
  policies?: Partial<MailOverlay['policies']>;
};

@ApiBearerAuth()
@ApiTags('Mail')
@Controller('admin/email')
export class MailController {
  constructor(
    private readonly mail: MailService,
    private readonly overlay: MailOverlayStore,
    @InjectRepository(EmailDelivery)
    private readonly deliveries: Repository<EmailDelivery>,
    @InjectRepository(TenantSettings)
    private readonly settings: Repository<TenantSettings>,
  ) {}

  @Get('status')
  @RequirePermissions('settings:manage')
  async status(@Req() request: RequestContext) {
    await this.hydrate(request);
    return this.publicStatus();
  }

  @Patch('policy')
  @RequirePermissions('settings:manage')
  async updatePolicy(@Body() body: PolicyPatch, @Req() request: RequestContext) {
    await this.hydrate(request);
    const current = this.overlay.snapshot();
    const allowlist = Array.isArray(body.recipientAllowlist)
      ? body.recipientAllowlist.filter((item) => isValidEmailAddress(item))
      : current.recipientAllowlist;
    const next = this.overlay.replace({
      ...current,
      operatorDeliveryRequested:
        body.operatorDeliveryRequested === undefined
          ? current.operatorDeliveryRequested
          : body.operatorDeliveryRequested === true,
      recipientAllowlist: allowlist,
      policies: {
        ...current.policies,
        ...(body.policies ?? {}),
      },
    });
    await this.persist(request, next);
    return this.publicStatus();
  }

  @Post('verify')
  @RequirePermissions('settings:manage')
  async verify(@Req() request: RequestContext) {
    await this.hydrate(request);
    const result = await this.mail.verifyConnection();
    await this.persist(request, this.overlay.snapshot());
    return result;
  }

  @Post('test')
  @RequirePermissions('settings:manage')
  async test(@Body() body: { to?: string }, @Req() request: RequestContext) {
    await this.hydrate(request);
    const result = await this.mail.sendAdministratorTest(body.to ?? '', request.user?.sub ?? null);
    await this.persist(request, this.overlay.snapshot());
    return {
      accepted: result.accepted,
      status: result.status,
      deliveryId: result.deliveryId,
      reason: result.reason,
      recipientDelivered: false,
    };
  }

  @Get('deliveries')
  @RequirePermissions('settings:manage')
  deliveriesList(@Query('limit') limit?: string) {
    return this.deliveries.find({
      order: { createdAt: 'DESC' },
      take: Math.min(Number(limit) || 30, 100),
      select: {
        id: true,
        purpose: true,
        recipientDomain: true,
        subject: true,
        status: true,
        attempts: true,
        lastErrorSafe: true,
        acceptedAt: true,
        createdAt: true,
      },
    });
  }

  private publicStatus() {
    const status = this.mail.diagnostics();
    return JSON.parse(JSON.stringify(status, (key, value) => {
      if (/pass(word)?|secret|token/i.test(key)) return undefined;
      return value;
    }));
  }

  private async hydrate(request: RequestContext) {
    if (!request.tenant?.id) return;
    const row = await this.settings.findOne({
      where: { tenant: { id: request.tenant.id } },
    });
    const catalog = (row?.clinicalCatalog ?? {}) as Record<string, unknown>;
    this.overlay.hydrate(parseMailOverlay(catalog.emailOperations));
  }

  private async persist(request: RequestContext, overlay: MailOverlay) {
    if (!request.tenant?.id) return;
    const row = await this.settings.findOne({
      where: { tenant: { id: request.tenant.id } },
    });
    if (!row) return;
    const catalog = { ...(row.clinicalCatalog ?? {}) } as Record<string, unknown>;
    catalog.emailOperations = overlay;
    await this.settings.update(row.id, {
      clinicalCatalog: catalog as never,
      updatedBy: request.user?.sub ?? null,
    });
  }
}
