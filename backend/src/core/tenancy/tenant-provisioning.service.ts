import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import type { RequestContext } from '../../common/request-context';
import { Tenant, TenantSettings } from '../core.entities';
import type { ProvisionTenantDto } from '../platform/platform.dto';

const SAFE_SCHEMA = /^[a-z][a-z0-9_]*$/;

@Injectable()
export class TenantProvisioningService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(TenantSettings)
    private readonly settings: Repository<TenantSettings>,
  ) {}

  async listTenants() {
    const rows = await this.tenants.find({ order: { createdAt: 'DESC' } });
    return rows.map((tenant) => this.toTenantSummary(tenant));
  }

  async provision(dto: ProvisionTenantDto, request: RequestContext) {
    const code = dto.code.trim().toLowerCase();
    const schemaName = (dto.schemaName?.trim().toLowerCase() || code).replace(/-/g, '_');
    const subdomain = dto.subdomain?.trim().toLowerCase() || code;

    if (!SAFE_SCHEMA.test(schemaName) || !SAFE_SCHEMA.test(code)) {
      throw new ConflictException('Tenant code and schema must be lowercase letters, numbers, or underscores');
    }

    if (schemaName === 'demo' || schemaName === 'public') {
      throw new ConflictException('Reserved schema name');
    }

    const existing = await this.tenants.findOne({
      where: [{ code }, { subdomain }, { schemaName }],
    });
    if (existing) {
      throw new ConflictException('A tenant with this code, subdomain, or schema already exists');
    }

    const templateSettings = await this.settings
      .createQueryBuilder('settings')
      .innerJoinAndSelect('settings.tenant', 'tenant')
      .where('tenant.code = :code', { code: 'demo' })
      .getOne();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`SELECT public.clone_tenant_schema('demo', $1)`, [schemaName]);
      await queryRunner.query(`SELECT public.seed_tenant_rbac('demo', $1)`, [schemaName]);

      const tenantInsert = await queryRunner.query(
        `
          INSERT INTO public.tenants (
            name, code, schema_name, subdomain, address, moh_facility_code, licence_number, active, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
          RETURNING id
        `,
        [
          dto.name.trim(),
          code,
          schemaName,
          subdomain,
          dto.address?.trim() ?? null,
          dto.mohFacilityCode?.trim() ?? null,
          dto.licenceNumber?.trim() ?? null,
          request.user?.sub ?? null,
        ],
      );
      const tenantId = tenantInsert[0]?.id as string;

      await queryRunner.query(
        `
          INSERT INTO public.settings (
            tenant_id, sms_sender_name, patient_id_prefix, triage_system, clinical_catalog, created_by
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        `,
        [
          tenantId,
          dto.smsSenderName?.trim() || 'AfyaSasa',
          dto.patientIdPrefix?.trim() || code.toUpperCase().slice(0, 4),
          templateSettings?.triageSystem ?? 'manchester_ke',
          JSON.stringify(templateSettings?.clinicalCatalog ?? {}),
          request.user?.sub ?? null,
        ],
      );

      const adminRole = await queryRunner.query(
        `SELECT id FROM "${schemaName}".roles WHERE name = 'administrator' LIMIT 1`,
      );
      const roleId = adminRole[0]?.id as string | undefined;
      if (!roleId) {
        throw new InternalServerErrorException('Administrator role missing in provisioned schema');
      }

      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
      const userInsert = await queryRunner.query(
        `
          INSERT INTO "${schemaName}".users (
            employee_no, first_name, last_name, email, password_hash, active, force_password_change, created_by
          )
          VALUES ($1, $2, $3, $4, $5, true, true, $6)
          RETURNING id
        `,
        [
          dto.adminEmployeeNo?.trim() || `${code.toUpperCase()}-ADMIN`,
          dto.adminFirstName.trim(),
          dto.adminLastName.trim(),
          dto.adminEmail.trim().toLowerCase(),
          passwordHash,
          request.user?.sub ?? null,
        ],
      );
      const userId = userInsert[0]?.id as string;

      await queryRunner.query(
        `INSERT INTO "${schemaName}".user_roles (user_id, role_id) VALUES ($1, $2)`,
        [userId, roleId],
      );

      await queryRunner.commitTransaction();

      const tenant = await this.tenants.findOneOrFail({ where: { id: tenantId } });
      return {
        tenant: this.toTenantSummary(tenant),
        adminUser: {
          id: userId,
          email: dto.adminEmail.trim().toLowerCase(),
          forcePasswordChange: true,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      try {
        await this.dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } catch {
        // best-effort cleanup after failed provision
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async setActive(tenantId: string, active: boolean, request: RequestContext) {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    if (tenant.code === 'demo') {
      throw new ConflictException('The demo tenant cannot be deactivated');
    }

    await this.tenants.update(tenantId, {
      active,
      updatedBy: request.user?.sub ?? null,
    });

    const updated = await this.tenants.findOneOrFail({ where: { id: tenantId } });
    return this.toTenantSummary(updated);
  }

  private toTenantSummary(tenant: Tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      schemaName: tenant.schemaName,
      subdomain: tenant.subdomain,
      active: tenant.active,
      mohFacilityCode: tenant.mohFacilityCode,
      createdAt: tenant.createdAt,
    };
  }
}
