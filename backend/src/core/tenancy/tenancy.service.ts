import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TenantContext } from '../../common/request-context';
import { Tenant } from '../core.entities';

@Injectable()
export class TenancyService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
  ) {}

  async resolveTenant(identifier: string): Promise<TenantContext> {
    const normalized = identifier.trim().toLowerCase();
    const tenant = await this.tenants.findOne({
      where: [{ subdomain: normalized }, { code: normalized }],
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

    const hostname = host?.split(':')[0] ?? '';
    const [subdomain] = hostname.split('.');
    return subdomain || 'demo';
  }
}
