import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TenantContext } from '../../common/request-context';
import { defaultTenantCode, tenantLookupCodes } from '../../common/tenant-defaults';
import { Tenant, TenantSettings } from '../core.entities';

export type PublicHospitalSummary = {
  code: string;
  name: string;
  address: string | null;
  mohFacilityCode: string | null;
  licenceNumber: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
  tagline: string | null;
};

@Injectable()
export class TenancyService {
  private readonly defaultTenantCode: string;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(TenantSettings)
    private readonly settings: Repository<TenantSettings>,
    config: ConfigService,
  ) {
    this.defaultTenantCode = config.get<string>('DEFAULT_TENANT_CODE', defaultTenantCode());
  }

  async resolveTenant(identifier: string): Promise<TenantContext> {
    const tenant = await this.tenants.findOne({
      where: tenantLookupCodes(identifier).flatMap((code) => [
        { subdomain: code },
        { code },
      ]),
    });

    if (!tenant || !tenant.active) {
      throw new NotFoundException('Tenant not found or inactive');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      schemaName: tenant.schemaName,
      subdomain: tenant.subdomain,
    };
  }

  async listPublicHospitals(): Promise<PublicHospitalSummary[]> {
    const rows = await this.tenants.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
    const summaries = await Promise.all(rows.map((tenant) => this.toPublicHospital(tenant)));
    return summaries;
  }

  async getPublicHospital(code: string): Promise<PublicHospitalSummary> {
    const tenant = await this.tenants.findOne({
      where: tenantLookupCodes(code).flatMap((lookup) => [{ code: lookup }, { subdomain: lookup }]),
    });
    if (!tenant || !tenant.active) {
      throw new NotFoundException('Hospital not found or inactive');
    }
    return this.toPublicHospital(tenant);
  }

  private async toPublicHospital(tenant: Tenant): Promise<PublicHospitalSummary> {
    const settings = await this.settings.findOne({
      where: { tenant: { id: tenant.id } },
      relations: { tenant: true },
    });
    const catalog = (settings?.clinicalCatalog ?? {}) as {
      hospitalProfile?: {
        primaryColor?: string;
        logoUrl?: string;
        tagline?: string;
        facilityName?: string;
      };
    };
    const profile = catalog.hospitalProfile ?? {};
    return {
      code: tenant.code,
      name: profile.facilityName?.trim() || tenant.name,
      address: tenant.address,
      mohFacilityCode: tenant.mohFacilityCode,
      licenceNumber: tenant.licenceNumber,
      primaryColor: profile.primaryColor?.trim() || '#0d9488',
      logoUrl: profile.logoUrl?.trim() || null,
      tagline: profile.tagline?.trim() || null,
    };
  }

  extractTenantIdentifier(host?: string, header?: string | string[]): string {
    if (typeof header === 'string' && header.trim().length > 0) {
      return header;
    }

    const hostname = host?.split(':')[0]?.toLowerCase() ?? '';
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
      return this.defaultTenantCode;
    }

    const [subdomain] = hostname.split('.');
    return subdomain || this.defaultTenantCode;
  }
}
