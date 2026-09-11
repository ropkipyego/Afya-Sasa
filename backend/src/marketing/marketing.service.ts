import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { TenantSettings, User } from '../core/core.entities';
import { MARKETING_ACTIVITY_TYPES, MARKETING_PERMISSIONS } from './marketing.constants';
import {
  CreateMarketingActivityDto,
  CreateMarketingVisitDto,
  ImportMarketingCatalogDto,
  ListMarketingActivitiesQuery,
  UpdateMarketingActivityDto,
} from './marketing.dto';
import { MarketingVisit } from './marketing.entities';

type PeriodTotals = {
  activities: number;
  locationsVisited: number;
  facilitiesContacted: number;
  contactsReached: number;
  peopleReached: number;
  leads: number;
  referrals: number;
  followUpsDue: number;
  followUpsCompleted: number;
};

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    @InjectRepository(TenantSettings)
    private readonly settings: Repository<TenantSettings>,
    @InjectRepository(MarketingVisit)
    private readonly activities: Repository<MarketingVisit>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async listActivities(query: ListMarketingActivitiesQuery, request: RequestContext) {
    const actorId = this.requireActor(request);
    const canSeeTeam = this.canSeeTeam(request);
    if (query.staffId && query.staffId !== actorId && !canSeeTeam) {
      throw new ForbiddenException('You can only view your own marketing activities');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.activities
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.owner', 'owner')
      .orderBy('activity.activityDate', 'DESC')
      .addOrderBy('activity.createdAt', 'DESC');

    if (!canSeeTeam) {
      qb.andWhere('owner.id = :actorId', { actorId });
    } else if (query.staffId) {
      qb.andWhere('owner.id = :staffId', { staffId: query.staffId });
    }

    if (query.date) {
      qb.andWhere('activity.activityDate = :date', { date: query.date.slice(0, 10) });
    } else {
      const from = query.from?.slice(0, 10);
      const to = query.to?.slice(0, 10);
      if (from) qb.andWhere('activity.activityDate >= :from', { from });
      if (to) qb.andWhere('activity.activityDate <= :to', { to });
      if (!from && !to) {
        qb.andWhere('activity.activityDate >= :defaultFrom', {
          defaultFrom: shiftDate(todayIso(), -31),
        });
      }
    }

    if (query.location) {
      qb.andWhere('activity.location ILIKE :location', { location: `%${query.location}%` });
    }
    if (query.facility) {
      qb.andWhere('activity.facilityName ILIKE :facility', { facility: `%${query.facility}%` });
    }
    if (query.activityType) {
      qb.andWhere('activity.activityType = :activityType', { activityType: query.activityType });
    }
    if (query.outcome) {
      qb.andWhere('activity.outcome = :outcome', { outcome: query.outcome });
    }
    if (query.service) {
      qb.andWhere('activity.servicesPromoted ILIKE :service', { service: `%${query.service}%` });
    }
    this.applyFollowUpFilter(qb, query.followUp);

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: rows.map((row) => this.toActivityResponse(row)),
      total,
      page,
      pageSize,
    };
  }

  async getActivity(id: string, request: RequestContext) {
    const activity = await this.loadActivity(id);
    this.assertCanView(request, activity);
    return this.toActivityResponse(activity);
  }

  async createActivity(dto: CreateMarketingActivityDto, request: RequestContext) {
    const actorId = this.requireActor(request);
    const ownerUserId = this.resolveOwnerUserId(dto.ownerUserId, request);
    this.assertActivityRules(dto);
    await this.ensureUserExists(ownerUserId);

    const saved = await this.activities.save(
      this.activities.create({
        owner: { id: ownerUserId } as User,
        activityDate: dto.activityDate.slice(0, 10),
        location: dto.location ?? null,
        facilityName: dto.facilityName,
        contactPerson: dto.contactPerson ?? null,
        contactPhone: dto.contactPhone ?? null,
        purpose: dto.purpose ?? null,
        activityType: dto.activityType,
        servicesPromoted: dto.servicesPromoted ?? null,
        peopleReached: dto.peopleReached ?? 0,
        leadsGenerated: dto.leadsGenerated ?? 0,
        referralsGenerated: dto.referralsGenerated ?? 0,
        followUpRequired: dto.followUpRequired ?? false,
        followUpDate: dto.followUpDate?.slice(0, 10) ?? null,
        followUpCompleted: dto.followUpCompleted ?? false,
        outcome: dto.outcome ?? null,
        nextAction: dto.nextAction ?? null,
        notes: dto.notes ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );

    this.logger.log(
      `marketing_activity_created id=${saved.id} owner=${ownerUserId} date=${saved.activityDate}`,
    );
    return this.toActivityResponse(await this.loadActivity(saved.id));
  }

  async updateActivity(id: string, dto: UpdateMarketingActivityDto, request: RequestContext) {
    const activity = await this.loadActivity(id);
    this.assertCanUpdate(request, activity);
    this.assertActivityRules({
      activityDate: dto.activityDate ?? String(activity.activityDate).slice(0, 10),
      followUpRequired: dto.followUpRequired ?? activity.followUpRequired,
      followUpDate:
        dto.followUpDate !== undefined
          ? dto.followUpDate
          : activity.followUpDate
            ? String(activity.followUpDate).slice(0, 10)
            : undefined,
      peopleReached: dto.peopleReached ?? activity.peopleReached,
      leadsGenerated: dto.leadsGenerated ?? activity.leadsGenerated,
      referralsGenerated: dto.referralsGenerated ?? activity.referralsGenerated,
    });

    if (dto.ownerUserId && dto.ownerUserId !== activity.owner.id) {
      if (!this.canManage(request)) {
        throw new ForbiddenException('You cannot change the owner of this activity');
      }
      await this.ensureUserExists(dto.ownerUserId);
      activity.owner = { id: dto.ownerUserId } as User;
    }

    if (dto.activityDate !== undefined) activity.activityDate = dto.activityDate.slice(0, 10);
    if (dto.location !== undefined) activity.location = dto.location ?? null;
    if (dto.facilityName !== undefined) activity.facilityName = dto.facilityName;
    if (dto.contactPerson !== undefined) activity.contactPerson = dto.contactPerson ?? null;
    if (dto.contactPhone !== undefined) activity.contactPhone = dto.contactPhone ?? null;
    if (dto.purpose !== undefined) activity.purpose = dto.purpose ?? null;
    if (dto.activityType !== undefined) activity.activityType = dto.activityType;
    if (dto.servicesPromoted !== undefined) activity.servicesPromoted = dto.servicesPromoted ?? null;
    if (dto.peopleReached !== undefined) activity.peopleReached = dto.peopleReached;
    if (dto.leadsGenerated !== undefined) activity.leadsGenerated = dto.leadsGenerated;
    if (dto.referralsGenerated !== undefined) {
      activity.referralsGenerated = dto.referralsGenerated;
    }
    if (dto.followUpRequired !== undefined) activity.followUpRequired = dto.followUpRequired;
    if (dto.followUpDate !== undefined) {
      activity.followUpDate = dto.followUpDate ? dto.followUpDate.slice(0, 10) : null;
    }
    if (dto.followUpCompleted !== undefined) activity.followUpCompleted = dto.followUpCompleted;
    if (dto.outcome !== undefined) activity.outcome = dto.outcome ?? null;
    if (dto.nextAction !== undefined) activity.nextAction = dto.nextAction ?? null;
    if (dto.notes !== undefined) activity.notes = dto.notes ?? null;
    activity.updatedBy = this.requireActor(request);

    await this.activities.save(activity);
    this.logger.log(`marketing_activity_updated id=${id}`);
    return this.toActivityResponse(await this.loadActivity(id));
  }

  async deleteActivity(id: string, request: RequestContext) {
    const activity = await this.loadActivity(id);
    this.assertCanDelete(request, activity);
    await this.activities.softRemove(activity);
    this.logger.log(`marketing_activity_deleted id=${id}`);
    return { id, deleted: true };
  }

  async getDashboard(request: RequestContext, staffId?: string) {
    const actorId = this.requireActor(request);
    const ownerId = this.resolveDashboardOwner(staffId?.trim() || undefined, request, actorId);
    const today = todayIso();
    const weekStart = shiftDate(today, -6);
    const monthStart = `${today.slice(0, 7)}-01`;
    const rangeStart = weekStart < monthStart ? weekStart : monthStart;

    const rows = await this.activities
      .createQueryBuilder('activity')
      .leftJoin('activity.owner', 'owner')
      .where('owner.id = :ownerId', { ownerId })
      .andWhere('activity.activityDate >= :rangeStart', { rangeStart })
      .getMany();

    return {
      today: this.summarizePeriod(rows, today, today, today),
      week: this.summarizePeriod(rows, weekStart, today, today),
      month: this.summarizePeriod(rows, monthStart, today, today),
    };
  }

  async getTeamSummary(query: ListMarketingActivitiesQuery, request: RequestContext) {
    if (!this.canSeeTeam(request)) {
      throw new ForbiddenException('Marketing reports require management access');
    }

    const from = (query.from ?? query.date ?? shiftDate(todayIso(), -31)).slice(0, 10);
    const to = (query.to ?? query.date ?? todayIso()).slice(0, 10);
    const qb = this.activities
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.owner', 'owner')
      .where('activity.activityDate >= :from', { from })
      .andWhere('activity.activityDate <= :to', { to });

    if (query.staffId) qb.andWhere('owner.id = :staffId', { staffId: query.staffId });
    if (query.location) {
      qb.andWhere('activity.location ILIKE :location', { location: `%${query.location}%` });
    }
    if (query.facility) {
      qb.andWhere('activity.facilityName ILIKE :facility', { facility: `%${query.facility}%` });
    }
    if (query.activityType) {
      qb.andWhere('activity.activityType = :activityType', { activityType: query.activityType });
    }
    if (query.outcome) qb.andWhere('activity.outcome = :outcome', { outcome: query.outcome });
    if (query.service) {
      qb.andWhere('activity.servicesPromoted ILIKE :service', { service: `%${query.service}%` });
    }

    const rows = await qb.getMany();
    const today = todayIso();
    return {
      from,
      to,
      totals: this.summarizePeriod(rows, from, to, today),
      byStaff: this.groupCount(rows, (row) => row.owner?.id ?? 'unknown', (row) =>
        ownerName(row.owner),
      ),
      byDate: this.groupCount(rows, (row) => String(row.activityDate).slice(0, 10)),
      byLocation: this.groupCount(rows, (row) => row.location || 'Unspecified'),
      byFacility: this.groupCount(rows, (row) => row.facilityName),
      byActivityType: this.groupCount(rows, (row) => row.activityType),
      byOutcome: this.groupCount(rows, (row) => row.outcome || 'Unspecified'),
      byService: this.groupServices(rows),
      pendingFollowUps: rows.filter((row) => row.followUpRequired && !row.followUpCompleted).length,
      completedFollowUps: rows.filter((row) => row.followUpCompleted).length,
    };
  }

  async createLegacyVisit(dto: CreateMarketingVisitDto, request: RequestContext) {
    const knownType = MARKETING_ACTIVITY_TYPES.includes(
      dto.activity as (typeof MARKETING_ACTIVITY_TYPES)[number],
    );
    return this.createActivity(
      {
        activityDate: dto.visitDate,
        facilityName: dto.facilityName.trim(),
        contactPerson: dto.contactPerson?.trim() || undefined,
        activityType: knownType ? dto.activity : 'other',
        purpose: knownType ? undefined : dto.activity.trim(),
        peopleReached: dto.peopleReached,
        nextAction: dto.nextAction?.trim() || undefined,
      },
      request,
    );
  }

  async listLegacyVisits(request: RequestContext) {
    const result = await this.listActivities({ page: 1, pageSize: 100 }, request);
    return result.items.map((item) => ({
      id: item.id,
      visitDate: item.activityDate,
      officerName: item.ownerName,
      facilityName: item.facilityName,
      contactPerson: item.contactPerson,
      activity: item.purpose || item.activityType,
      peopleReached: item.peopleReached,
      nextAction: item.nextAction,
      createdAt: item.createdAt,
      createdBy: item.createdBy,
    }));
  }

  async getCatalog(request: RequestContext) {
    const settings = await this.loadSettings(request);
    const catalog = (settings.clinicalCatalog ?? {}) as {
      marketingSites?: string[];
      marketingActivities?: string[];
    };
    return {
      sites: uniqueNames(catalog.marketingSites),
      activities: uniqueNames(catalog.marketingActivities),
    };
  }

  async importCatalog(dto: ImportMarketingCatalogDto, request: RequestContext) {
    const rows = parseCsv(dto.csv);
    if (!rows.length) {
      throw new BadRequestException('CSV is empty or missing a header row.');
    }
    const settings = await this.loadSettings(request);
    const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
    const sites = uniqueNames(catalog.marketingSites as string[] | undefined);
    const activities = uniqueNames(catalog.marketingActivities as string[] | undefined);
    const summary = { sitesAdded: 0, activitiesAdded: 0, skipped: 0, errors: [] as string[] };

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const type = (row.type ?? row.kind ?? '').trim().toLowerCase();
      const name = (row.name ?? row.label ?? row.site ?? row.activity ?? '').trim();
      if (!name) {
        summary.errors.push(`Line ${line}: name is required.`);
        continue;
      }
      if (type === 'site' || type === 'facility' || type === 'school' || type === 'location') {
        if (sites.some((item) => item.toLowerCase() === name.toLowerCase())) {
          summary.skipped += 1;
          continue;
        }
        sites.push(name);
        summary.sitesAdded += 1;
        continue;
      }
      if (type === 'activity' || type === 'service' || type === 'programme') {
        if (activities.some((item) => item.toLowerCase() === name.toLowerCase())) {
          summary.skipped += 1;
          continue;
        }
        activities.push(name);
        summary.activitiesAdded += 1;
        continue;
      }
      summary.errors.push(`Line ${line}: type must be site or activity.`);
    }

    catalog.marketingSites = sites;
    catalog.marketingActivities = activities;
    await this.settings.update(settings.id, {
      clinicalCatalog: catalog as never,
      updatedBy: request.user?.sub ?? null,
    });
    return { ...summary, sites, activities };
  }

  resolveOwnerUserId(requestedOwnerId: string | undefined, request: RequestContext): string {
    const actorId = this.requireActor(request);
    if (!requestedOwnerId || requestedOwnerId === actorId) {
      return actorId;
    }
    if (!this.canManage(request)) {
      throw new ForbiddenException('You cannot create an activity for another staff member');
    }
    return requestedOwnerId;
  }

  assertActivityRules(dto: {
    activityDate: string;
    followUpRequired?: boolean;
    followUpDate?: string;
    peopleReached?: number;
    leadsGenerated?: number;
    referralsGenerated?: number;
  }) {
    if (!dto.activityDate?.trim()) {
      throw new BadRequestException('Activity date is required');
    }
    for (const [label, value] of [
      ['People reached', dto.peopleReached],
      ['Leads generated', dto.leadsGenerated],
      ['Referrals generated', dto.referralsGenerated],
    ] as const) {
      if (value !== undefined && value < 0) {
        throw new BadRequestException(`${label} cannot be negative`);
      }
    }
    if (dto.followUpRequired && !dto.followUpDate) {
      throw new BadRequestException('Follow-up date is required when a follow-up is needed');
    }
    if (dto.followUpDate && dto.activityDate && dto.followUpDate < dto.activityDate) {
      throw new BadRequestException('Follow-up date cannot be before the activity date');
    }
  }

  private applyFollowUpFilter(
    qb: ReturnType<Repository<MarketingVisit>['createQueryBuilder']>,
    followUp?: ListMarketingActivitiesQuery['followUp'],
  ) {
    if (followUp === 'required') {
      qb.andWhere('activity.followUpRequired = true').andWhere('activity.followUpCompleted = false');
    } else if (followUp === 'completed') {
      qb.andWhere('activity.followUpCompleted = true');
    } else if (followUp === 'overdue') {
      qb.andWhere('activity.followUpRequired = true')
        .andWhere('activity.followUpCompleted = false')
        .andWhere('activity.followUpDate IS NOT NULL')
        .andWhere('activity.followUpDate < :today', { today: todayIso() });
    } else if (followUp === 'none') {
      qb.andWhere('activity.followUpRequired = false');
    }
  }

  private async loadActivity(id: string) {
    const activity = await this.activities.findOne({
      where: { id },
      relations: { owner: true },
    });
    if (!activity) {
      throw new NotFoundException('Marketing activity not found');
    }
    return activity;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Staff member not found');
    }
    return user;
  }

  private toActivityResponse(activity: MarketingVisit) {
    return {
      id: activity.id,
      activityDate: String(activity.activityDate).slice(0, 10),
      ownerUserId: activity.owner?.id ?? null,
      ownerName: ownerName(activity.owner),
      location: activity.location,
      facilityName: activity.facilityName,
      contactPerson: activity.contactPerson,
      contactPhone: activity.contactPhone,
      purpose: activity.purpose,
      activityType: activity.activityType,
      servicesPromoted: activity.servicesPromoted,
      peopleReached: activity.peopleReached,
      leadsGenerated: activity.leadsGenerated,
      referralsGenerated: activity.referralsGenerated,
      followUpRequired: activity.followUpRequired,
      followUpDate: activity.followUpDate ? String(activity.followUpDate).slice(0, 10) : null,
      followUpCompleted: activity.followUpCompleted,
      outcome: activity.outcome,
      nextAction: activity.nextAction,
      notes: activity.notes,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      createdBy: activity.createdBy,
      updatedBy: activity.updatedBy,
    };
  }

  private summarizePeriod(
    rows: MarketingVisit[],
    from: string,
    to: string,
    today: string,
  ): PeriodTotals {
    const scoped = rows.filter((row) => {
      const date = String(row.activityDate).slice(0, 10);
      return date >= from && date <= to;
    });
    return {
      activities: scoped.length,
      locationsVisited: uniqueCount(scoped.map((row) => row.location)),
      facilitiesContacted: uniqueCount(scoped.map((row) => row.facilityName)),
      contactsReached: uniqueCount(scoped.map((row) => row.contactPerson)),
      peopleReached: sum(scoped.map((row) => row.peopleReached)),
      leads: sum(scoped.map((row) => row.leadsGenerated)),
      referrals: sum(scoped.map((row) => row.referralsGenerated)),
      followUpsDue: scoped.filter(
        (row) =>
          row.followUpRequired &&
          !row.followUpCompleted &&
          row.followUpDate &&
          String(row.followUpDate).slice(0, 10) <= today,
      ).length,
      followUpsCompleted: scoped.filter((row) => row.followUpCompleted).length,
    };
  }

  private groupCount(
    rows: MarketingVisit[],
    keyOf: (row: MarketingVisit) => string,
    labelOf?: (row: MarketingVisit) => string,
  ) {
    const map = new Map<
      string,
      { key: string; label: string; activities: number; peopleReached: number; leads: number; referrals: number }
    >();
    for (const row of rows) {
      const key = keyOf(row);
      const current = map.get(key) ?? {
        key,
        label: labelOf?.(row) ?? key,
        activities: 0,
        peopleReached: 0,
        leads: 0,
        referrals: 0,
      };
      current.activities += 1;
      current.peopleReached += row.peopleReached ?? 0;
      current.leads += row.leadsGenerated ?? 0;
      current.referrals += row.referralsGenerated ?? 0;
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.activities - a.activities);
  }

  private groupServices(rows: MarketingVisit[]) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const parts = (row.servicesPromoted ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      for (const part of parts) {
        map.set(part, (map.get(part) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([label, activities]) => ({ key: label, label, activities }))
      .sort((a, b) => b.activities - a.activities);
  }

  private assertCanView(request: RequestContext, activity: MarketingVisit) {
    const actorId = this.requireActor(request);
    if (activity.owner?.id === actorId || this.canSeeTeam(request)) return;
    throw new ForbiddenException('You can only view your own marketing activities');
  }

  private assertCanUpdate(request: RequestContext, activity: MarketingVisit) {
    const actorId = this.requireActor(request);
    if (this.canManage(request)) return;
    if (activity.owner?.id === actorId && this.hasPermission(request, MARKETING_PERMISSIONS.update)) {
      return;
    }
    throw new ForbiddenException('You cannot edit this marketing activity');
  }

  private assertCanDelete(request: RequestContext, activity: MarketingVisit) {
    const actorId = this.requireActor(request);
    if (this.canManage(request)) return;
    if (activity.owner?.id === actorId && this.hasPermission(request, MARKETING_PERMISSIONS.delete)) {
      return;
    }
    throw new ForbiddenException('You cannot delete this marketing activity');
  }

  private resolveDashboardOwner(staffId: string | undefined, request: RequestContext, actorId: string) {
    if (!staffId || staffId === actorId) return actorId;
    if (!this.canSeeTeam(request)) {
      throw new ForbiddenException('You can only view your own marketing dashboard');
    }
    return staffId;
  }

  private requireActor(request: RequestContext) {
    const actorId = request.user?.sub;
    if (!actorId) {
      throw new ForbiddenException('Authenticated staff is required');
    }
    return actorId;
  }

  private canManage(request: RequestContext) {
    return this.hasPermission(request, MARKETING_PERMISSIONS.manage);
  }

  private canSeeTeam(request: RequestContext) {
    return (
      this.hasPermission(request, MARKETING_PERMISSIONS.manage) ||
      this.hasPermission(request, MARKETING_PERMISSIONS.reports)
    );
  }

  private hasPermission(request: RequestContext, permission: string) {
    return (request.user?.permissions ?? []).includes(permission);
  }

  private async loadSettings(request: RequestContext) {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      throw new BadRequestException('Tenant context missing');
    }
    const settings = await this.settings.findOne({ where: { tenant: { id: tenantId } } });
    if (!settings) {
      throw new NotFoundException('Hospital settings not found');
    }
    return settings;
  }
}

function ownerName(owner?: User | null) {
  if (!owner) return 'Unknown staff';
  return `${owner.firstName} ${owner.lastName}`.trim();
}

function uniqueNames(values?: string[] | null) {
  return [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
}

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.map((value) => value?.trim()).filter(Boolean)).size;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
