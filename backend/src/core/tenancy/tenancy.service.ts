import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TenantContext } from '../../common/request-context';
import { defaultTenantCode, tenantLookupCodes } from '../../common/tenant-defaults';
import { Tenant } from '../core.entities';

@Injectable()
export class TenancyService {
  private readonly defaultTenantCode: string;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
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
