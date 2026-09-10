import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { TenantSettings } from '../core/core.entities';
import { CreateMarketingVisitDto, ImportMarketingCatalogDto } from './marketing.dto';

export type MarketingVisit = {
  id: string
  visitDate: string
  officerName: string
  facilityName: string
  contactPerson: string | null
  activity: string
  peopleReached: number
  nextAction: string | null
  createdAt: string
  createdBy: string | null
};

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(TenantSettings)
    private readonly settings: Repository<TenantSettings>,
  ) {}

  async listVisits(request: RequestContext) {
    const visits = await this.readVisits(request);
    return [...visits].sort((a, b) => `${b.visitDate}${b.createdAt}`.localeCompare(`${a.visitDate}${a.createdAt}`));
  }

  async getCatalog(request: RequestContext) {
    const settings = await this.loadSettings(request);
    const catalog = (settings.clinicalCatalog ?? {}) as {
      marketingSites?: string[]
      marketingActivities?: string[]
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

  async createVisit(dto: CreateMarketingVisitDto, request: RequestContext) {
    const settings = await this.loadSettings(request);
    const visit: MarketingVisit = {
      id: randomUUID(),
      visitDate: dto.visitDate.slice(0, 10),
      officerName: dto.officerName.trim(),
      facilityName: dto.facilityName.trim(),
      contactPerson: dto.contactPerson?.trim() || null,
      activity: dto.activity.trim(),
      peopleReached: dto.peopleReached,
      nextAction: dto.nextAction?.trim() || null,
      createdAt: new Date().toISOString(),
      createdBy: request.user?.sub ?? null,
    };
    const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
    const visits = Array.isArray(catalog.marketingVisits) ? [...(catalog.marketingVisits as MarketingVisit[])] : [];
    visits.push(visit);
    catalog.marketingVisits = visits;
    await this.settings.update(settings.id, {
      clinicalCatalog: catalog as never,
      updatedBy: request.user?.sub ?? null,
    });
    return visit;
  }

  private async readVisits(request: RequestContext) {
    const settings = await this.loadSettings(request);
    const raw = (settings.clinicalCatalog as { marketingVisits?: MarketingVisit[] } | undefined)?.marketingVisits;
    return Array.isArray(raw) ? raw : [];
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

function uniqueNames(values?: string[] | null) {
  return [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))];
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
