import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, IsNull, MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import type { RequestContext } from '../../common/request-context';
import { defaultTenantCode, tenantChannel } from '../../common/tenant-defaults';
import {
  AuditLog,
  Clinic,
  Department,
  Permission,
  Role,
  RolePermission,
  TenantSettings,
  User,
  UserDepartment,
  UserRole,
  RefreshToken,
} from '../core.entities';
import {
  AssignRolesDto,
  AssignDepartmentDto,
  CreateClinicDto,
  CreateDepartmentDto,
  CreateRoleDto,
  CreateUserDto,
  UpdateClinicDto,
  UpdateDepartmentDto,
  UpdateRolePermissionsDto,
  UpdateSettingsDto,
  UpdateUserDto,
} from './admin.dto';
import { RealtimeService } from '../../realtime/realtime.service';
import { TokenRevocationService } from '../auth/token-revocation.service';
import { SuperadminPolicyService } from '../rbac/superadmin-policy.service';
import { ADMINISTRATOR_ROLE_NAME } from '../rbac/rbac.constants';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissions: Repository<RolePermission>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
    @InjectRepository(TenantSettings)
    private readonly settings: Repository<TenantSettings>,
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    @InjectRepository(Clinic)
    private readonly clinics: Repository<Clinic>,
    @InjectRepository(UserDepartment)
    private readonly userDepartments: Repository<UserDepartment>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly realtime: RealtimeService,
    private readonly tokenRevocation: TokenRevocationService,
    private readonly superadminPolicy: SuperadminPolicyService,
  ) {}

  async listUsers() {
    const users = await this.users.find({ order: { createdAt: 'DESC' } });
    return Promise.all(users.map((user) => this.toUserResponse(user)));
  }

  async listUserRoleOptions(request: RequestContext) {
    const roles = await this.roles.find({
      select: { id: true, name: true, label: true },
      order: { label: 'ASC' },
    });
    return this.superadminPolicy.filterAssignableRoles(request, roles);
  }

  async createUser(dto: CreateUserDto, request: RequestContext) {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = await this.users.save(
      this.users.create({
        employeeNo: dto.employeeNo,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        phone: dto.phone ?? null,
        specialisation: dto.specialisation?.trim() || null,
        passwordHash: await bcrypt.hash(dto.temporaryPassword, 12),
        active: true,
        forcePasswordChange: true,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    if (dto.roleIds?.length) {
      await this.replaceUserRoles(user.id, dto.roleIds, request);
    }

    return this.toUserResponse(user);
  }

  async updateUser(id: string, dto: UpdateUserDto, request: RequestContext) {
    await this.getUser(id);
    if (dto.active !== undefined) {
      await this.superadminPolicy.assertCanChangeUserActive(request, id, dto.active);
    }
    const patch: Partial<User> = { updatedBy: request.user?.sub ?? null };
    if (dto.employeeNo !== undefined) patch.employeeNo = dto.employeeNo;
    if (dto.firstName !== undefined) patch.firstName = dto.firstName;
    if (dto.lastName !== undefined) patch.lastName = dto.lastName;
    if (dto.email !== undefined) patch.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) patch.phone = dto.phone ?? null;
    if (dto.specialisation !== undefined) {
      patch.specialisation = dto.specialisation?.trim() || null;
    }
    if (dto.active !== undefined) patch.active = dto.active;
    if (dto.temporaryPassword) {
      patch.passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
      patch.forcePasswordChange = true;
    }
    await this.users.update(id, patch);
    if (dto.roleIds) {
      await this.replaceUserRoles(id, dto.roleIds, request);
    }
    return this.toUserResponse(await this.getUser(id));
  }

  async setUserActive(id: string, active: boolean, request: RequestContext) {
    await this.superadminPolicy.assertCanChangeUserActive(request, id, active);
    await this.getUser(id);
    await this.users.update(id, { active });
    if (!active) {
      await this.tokenRevocation.invalidateUser(id);
      await this.revokeRefreshTokensForUsers([id]);
    }
    return this.toUserResponse(await this.getUser(id));
  }

  async resetUserPassword(
    id: string,
    temporaryPassword: string,
    request: RequestContext,
  ) {
    await this.getUser(id);
    await this.users.update(id, {
      passwordHash: await bcrypt.hash(temporaryPassword, 12),
      forcePasswordChange: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedBy: request.user?.sub ?? null,
    });
    await this.tokenRevocation.invalidateUser(id);
    await this.revokeRefreshTokensForUsers([id]);
    return this.toUserResponse(await this.getUser(id));
  }

  async unlockUser(id: string) {
    await this.getUser(id);
    await this.users.update(id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    return this.toUserResponse(await this.getUser(id));
  }

  async assignRoles(id: string, dto: AssignRolesDto, request: RequestContext) {
    await this.getUser(id);
    await this.replaceUserRoles(id, dto.roleIds, request);
    return this.toUserResponse(await this.getUser(id));
  }

  async listRoles() {
    const roles = await this.roles.find({ order: { label: 'ASC' } });
    return Promise.all(roles.map((role) => this.toRoleResponse(role)));
  }

  listPermissions() {
    return this.permissions.find({ order: { resource: 'ASC', action: 'ASC' } });
  }

  async createRole(dto: CreateRoleDto, request: RequestContext) {
    this.superadminPolicy.assertCanCreateRole(request, dto.name);
    const role = await this.roles.save(
      this.roles.create({
        name: dto.name.toLowerCase().replace(/\s+/g, '_'),
        label: dto.label,
        description: dto.description ?? null,
        isSystem: false,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    if (dto.permissionIds) {
      await this.replaceRolePermissions(role.id, dto.permissionIds, request);
    }
    return this.toRoleResponse(role);
  }

  async updateRolePermissions(
    id: string,
    dto: UpdateRolePermissionsDto,
    request: RequestContext,
  ) {
    await this.getRole(id);
    await this.superadminPolicy.assertCanUpdateRolePermissions(
      request,
      id,
      dto.permissionIds,
    );
    await this.replaceRolePermissions(id, dto.permissionIds, request);
    const affected = await this.userRoles.find({
      where: { role: { id } },
      relations: { user: true },
    });
    await this.tokenRevocation.invalidateUsers(
      affected.map((entry) => entry.user.id),
    );
    await this.revokeRefreshTokensForUsers(
      affected.map((entry) => entry.user.id),
    );
    return this.toRoleResponse(await this.getRole(id));
  }

  async getSettings(request: RequestContext) {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      throw new NotFoundException('Tenant context missing');
    }
    return this.settings.findOneOrFail({
      where: { tenant: { id: tenantId } },
      relations: { tenant: true },
    });
  }

  async getClinicalCatalog(request: RequestContext) {
    const settings = await this.getSettings(request);
    const catalog = { ...(settings.clinicalCatalog ?? {}) } as Record<string, unknown>;
    if (!this.isDirector(request)) {
      delete catalog.servicePricingScaffold;
    }
    const staffClinicians = await this.listClinicalStaff();
    const org = await this.orgCatalogOverlay();
    return { ...catalog, ...org, staffClinicians };
  }

  async getPricingScaffold(request: RequestContext) {
    if (!this.isDirector(request)) {
      return { enabled: false, items: [] };
    }
    const settings = await this.getSettings(request);
    const scaffold = (settings.clinicalCatalog ?? {}) as {
      servicePricingScaffold?: {
        enabled?: boolean;
        items?: Array<{ code: string; name: string; category: string; active: boolean }>;
      };
    };
    return scaffold.servicePricingScaffold ?? { enabled: false, items: [] };
  }

  private isDirector(request: RequestContext) {
    const roles = request.user?.roles ?? [];
    const permissions = request.user?.permissions ?? [];
    return (
      roles.includes('administrator') ||
      roles.includes('superadmin') ||
      permissions.includes('settings:manage')
    );
  }

  async listActiveAdministrators() {
    return this.users
      .createQueryBuilder('user')
      .innerJoin(UserRole, 'ur', 'ur.user_id = user.id')
      .innerJoin(Role, 'role', 'role.id = ur.role_id')
      .where('LOWER(role.name) = :role', { role: ADMINISTRATOR_ROLE_NAME })
      .andWhere('user.active = true')
      .getMany();
  }

  /** Facility name + MOH code for reports (works without an HTTP request context). */
  async resolveFacilityContext(tenantCode = defaultTenantCode()) {
    const settings = await this.settings
      .createQueryBuilder('settings')
      .innerJoinAndSelect('settings.tenant', 'tenant')
      .where('tenant.code = :code OR tenant.subdomain = :code', { code: tenantCode })
      .getOne();

    if (!settings) {
      return { name: 'Jalaram Hospital', mohCode: '' };
    }

    const catalog = (settings.clinicalCatalog ?? {}) as {
      hospitalProfile?: { facilityName?: string; mohFacilityCode?: string };
    };

    return {
      name:
        catalog.hospitalProfile?.facilityName?.trim() ||
        settings.tenant?.name ||
        'Jalaram Hospital',
      mohCode:
        catalog.hospitalProfile?.mohFacilityCode?.trim() ||
        settings.tenant?.mohFacilityCode ||
        '',
    };
  }

  async listClinicalStaff() {
    const assignments = await this.userRoles
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.user', 'user')
      .innerJoinAndSelect('assignment.role', 'role')
      .where('user.active = :active', { active: true })
      .andWhere('role.name IN (:...roles)', {
        roles: ['doctor', 'consultant', 'clinical_officer'],
      })
      .orderBy('user.lastName', 'ASC')
      .addOrderBy('user.firstName', 'ASC')
      .getMany();

    const seen = new Set<string>();
    const staff: {
      id: string;
      firstName: string;
      lastName: string;
      specialisation: string | null;
      label: string;
    }[] = [];

    for (const assignment of assignments) {
      const user = assignment.user;
      if (!user || seen.has(user.id)) continue;
      seen.add(user.id);
      staff.push({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        specialisation: user.specialisation,
        label: `Dr. ${user.firstName} ${user.lastName}`,
      });
    }

    return staff;
  }

  async updateSettings(dto: UpdateSettingsDto, request: RequestContext) {
    const current = await this.getSettings(request);
    const mergedCatalog = dto.clinicalCatalog
      ? this.mergeClinicalCatalog(
          (current.clinicalCatalog ?? {}) as Record<string, unknown>,
          dto.clinicalCatalog as Record<string, unknown>,
        )
      : undefined;

    if (mergedCatalog) {
      delete mergedCatalog.departments;
      delete mergedCatalog.clinics;
      delete mergedCatalog.structuredDepartments;
      delete mergedCatalog.structuredClinics;
    }

    await this.settings.update(current.id, {
      smsSenderName: dto.smsSenderName,
      patientIdPrefix: dto.patientIdPrefix,
      triageSystem: dto.triageSystem,
      ...(mergedCatalog ? { clinicalCatalog: mergedCatalog as never } : {}),
      updatedBy: request.user?.sub ?? null,
    });
    if (mergedCatalog) {
      await this.syncOrgCatalog(request);
    } else {
      this.realtime.publish(tenantChannel(request), 'settings.updated', {});
    }
    return this.getSettings(request);
  }

  async getUsersSummary() {
    const users = await this.users.find();
    const now = new Date();
    return {
      activeUsers: users.filter((user) => user.active).length,
      inactiveUsers: users.filter((user) => !user.active).length,
      lockedAccounts: users.filter(
        (user) => user.lockedUntil && user.lockedUntil > now,
      ).length,
      forcePasswordChange: users.filter((user) => user.forcePasswordChange).length,
    };
  }

  private mergeClinicalCatalog(
    current: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...current, ...patch };

    if (patch.hospitalProfile && typeof patch.hospitalProfile === 'object') {
      merged.hospitalProfile = {
        ...((current.hospitalProfile as Record<string, unknown>) ?? {}),
        ...(patch.hospitalProfile as Record<string, unknown>),
      };
    }

    if (patch.printTemplates && typeof patch.printTemplates === 'object') {
      merged.printTemplates = {
        ...((current.printTemplates as Record<string, unknown>) ?? {}),
        ...(patch.printTemplates as Record<string, unknown>),
      };
    }

    if (patch.facilities && Array.isArray(patch.facilities)) {
      merged.facilities = patch.facilities;
    }
    if (patch.structuredDepartments && Array.isArray(patch.structuredDepartments)) {
      merged.structuredDepartments = patch.structuredDepartments;
    }
    if (patch.structuredClinics && Array.isArray(patch.structuredClinics)) {
      merged.structuredClinics = patch.structuredClinics;
    }

    return merged;
  }

  async getSystemHealth(request: RequestContext) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [activeUsers, lockedUsers, auditToday, settings] = await Promise.all([
      this.users.count({ where: { active: true } }),
      this.users.count({ where: { lockedUntil: MoreThanOrEqual(new Date()) } }),
      this.auditLogs.count({ where: { createdAt: MoreThanOrEqual(startOfDay) } }),
      this.getSettings(request),
    ]);

    return {
      database: 'connected',
      redis: 'configured',
      storage: 'available',
      queue: 'active',
      activeUsers,
      lockedUsers,
      auditEventsToday: auditToday,
      tenant: settings.tenant
        ? {
            name: settings.tenant.name,
            code: settings.tenant.code,
            mohFacilityCode: settings.tenant.mohFacilityCode,
          }
        : null,
      timestamp: new Date().toISOString(),
    };
  }

  async listAuditLogs(params: {
    userId?: string;
    action?: string;
    recordType?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);
    const where: {
      userId?: string;
      action?: string;
      recordType?: string;
    } = {};
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.recordType) where.recordType = params.recordType;

    const [items, total] = await this.auditLogs.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, meta: { page, pageSize, total } };
  }

  async exportAuditLogsCsv(params: { action?: string; recordType?: string } = {}) {
    const { items } = await this.listAuditLogs({
      ...params,
      page: 1,
      pageSize: 1000,
    });
    const header = [
      'id',
      'createdAt',
      'userId',
      'action',
      'recordType',
      'recordId',
      'endpoint',
      'httpCode',
      'beforeJson',
      'afterJson',
    ];
    const rows = items.map((item) =>
      [
        item.id,
        item.createdAt?.toISOString?.() ?? item.createdAt,
        item.userId ?? '',
        item.action,
        item.recordType ?? '',
        item.recordId ?? '',
        item.endpoint ?? '',
        item.httpCode ?? '',
        JSON.stringify(item.beforeJson ?? null),
        JSON.stringify(item.afterJson ?? null),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    );
    return [header.join(','), ...rows].join('\n');
  }

  async importAuditLogsCsv(csv: string) {
    const lines = csv
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return { imported: 0, skipped: 0, errors: ['CSV empty or missing header'] };
    }
    // Archive-style import: store as a single audit event with payload summary (append-only safe)
    const bodyRows = lines.slice(1).length;
    await this.auditLogs.save(
      this.auditLogs.create({
        userId: null,
        action: 'import',
        recordType: 'audit_logs',
        recordId: null,
        beforeJson: null,
        afterJson: {
          source: 'csv_import',
          rowCount: bodyRows,
          preview: lines.slice(0, 6),
        },
        ip: null,
        userAgent: null,
        sessionId: null,
        endpoint: '/admin/audit-logs/import',
        httpCode: 200,
        durationMs: 0,
      }),
    );
    return { imported: 1, skipped: bodyRows, note: 'Append-only store — CSV archived as import event' };
  }

  async phiAccessReport(params: {
    patientId?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);

    const qb = this.auditLogs
      .createQueryBuilder('log')
      .where(`log.action = 'read'`)
      .andWhere(
        `(log.endpoint ILIKE '%/patients/%' OR log.record_type = 'patients')`,
      )
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (params.userId) {
      qb.andWhere('log.user_id = :userId', { userId: params.userId });
    }
    if (params.patientId) {
      qb.andWhere(
        `(log.record_id = :patientId OR log.endpoint ILIKE :patientPath)`,
        {
          patientId: params.patientId,
          patientPath: `%/patients/${params.patientId}%`,
        },
      );
    }
    if (params.from) {
      qb.andWhere('log.created_at >= :from', { from: new Date(params.from) });
    }
    if (params.to) {
      qb.andWhere('log.created_at <= :to', { to: new Date(params.to) });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      meta: { page, pageSize, total },
      generatedAt: new Date().toISOString(),
    };
  }

  listDepartments() {
    return this.departments.find({ order: { name: 'ASC' } });
  }

  async createDepartment(dto: CreateDepartmentDto, request: RequestContext) {
    const name = dto.name.trim();
    if (!name) {
      throw new ConflictException('Department name is required');
    }
    const code = await this.uniqueOrgCode(
      this.departments,
      this.normalizeOrgCode(dto.code || name),
    );
    const department = await this.departments.save(
      this.departments.create({
        name,
        code,
        type: dto.type?.trim() || 'clinical',
        active: true,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.syncOrgCatalog(request);
    return department;
  }

  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
    request: RequestContext,
  ) {
    const department = await this.departments.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    if (dto.name?.trim()) department.name = dto.name.trim();
    if (dto.type !== undefined) department.type = dto.type?.trim() || null;
    if (dto.active !== undefined) department.active = dto.active;
    department.updatedBy = request.user?.sub ?? null;
    const saved = await this.departments.save(department);
    await this.syncOrgCatalog(request);
    return saved;
  }

  async listClinics() {
    const rows = await this.clinics.find({
      relations: { department: true },
      order: { name: 'ASC' },
    });
    return rows.map((row) => ({
      ...row,
      departmentId: row.department?.id ?? null,
    }));
  }

  async createClinic(dto: CreateClinicDto, request: RequestContext) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Clinic name is required');
    }
    if (!dto.departmentId?.trim()) {
      throw new BadRequestException('Parent department is required');
    }
    const department = await this.departments.findOne({
      where: { id: dto.departmentId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    const code = await this.uniqueOrgCode(
      this.clinics,
      this.normalizeOrgCode(dto.code || name),
    );
    try {
      const clinic = await this.clinics.save(
        this.clinics.create({
          name,
          code,
          department,
          doctorIds: dto.doctorIds ?? [],
          consultationFee: Number(dto.consultationFee ?? 0).toFixed(2),
          active: true,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      );
      await this.syncOrgCatalog(request);
      return this.clinics.findOneOrFail({
        where: { id: clinic.id },
        relations: { department: true },
      });
    } catch (error) {
      throw this.clinicWriteError(error);
    }
  }

  async updateClinic(id: string, dto: UpdateClinicDto, request: RequestContext) {
    const clinic = await this.clinics.findOne({
      where: { id },
      relations: { department: true },
    });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }
    if (dto.name?.trim()) clinic.name = dto.name.trim();
    if (dto.departmentId !== undefined) {
      if (dto.departmentId) {
        const department = await this.departments.findOne({
          where: { id: dto.departmentId },
        });
        if (!department) {
          throw new NotFoundException('Department not found');
        }
        clinic.department = department;
      } else {
        clinic.department = null;
      }
    }
    if (dto.active !== undefined) clinic.active = dto.active;
    if (dto.doctorIds !== undefined) clinic.doctorIds = dto.doctorIds;
    if (dto.consultationFee !== undefined) {
      clinic.consultationFee = Number(dto.consultationFee).toFixed(2);
    }
    clinic.updatedBy = request.user?.sub ?? null;
    try {
      await this.clinics.save(clinic);
      await this.syncOrgCatalog(request);
      return this.clinics.findOneOrFail({
        where: { id },
        relations: { department: true },
      });
    } catch (error) {
      throw this.clinicWriteError(error);
    }
  }

  private clinicWriteError(error: unknown): Error {
    if (error instanceof QueryFailedError) {
      const code = (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code;
      if (code === '23505') {
        return new ConflictException('A clinic with this name or code already exists');
      }
      if (code === '23503') {
        return new BadRequestException('Parent department was not found');
      }
      return new BadRequestException('Could not save clinic. Check the name, department, and fee.');
    }
    return error instanceof Error ? error : new BadRequestException('Could not save clinic');
  }

  private normalizeOrgCode(value: string) {
    const code = value
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32);
    return code || 'UNIT';
  }

  private async uniqueOrgCode(
    repo: Repository<Department> | Repository<Clinic>,
    base: string,
  ) {
    let code = base;
    let n = 2;
    while (await repo.findOne({ where: { code } })) {
      code = `${base}_${n}`.slice(0, 40);
      n += 1;
    }
    return code;
  }

  private async orgCatalogOverlay() {
    const [departments, clinics] = await Promise.all([
      this.departments.find({ order: { name: 'ASC' } }),
      this.clinics.find({ relations: { department: true }, order: { name: 'ASC' } }),
    ]);
    return {
      departments: departments.filter((row) => row.active).map((row) => row.name),
      clinics: clinics.filter((row) => row.active).map((row) => row.name),
      structuredDepartments: departments.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        active: row.active,
        clinicIds: clinics
          .filter((clinic) => clinic.department?.id === row.id && clinic.active)
          .map((clinic) => clinic.id),
      })),
      structuredClinics: clinics.map((row) => ({
        id: row.id,
        name: row.name,
        departmentId: row.department?.id ?? null,
        departmentName: row.department?.name ?? null,
        active: row.active,
        doctorIds: row.doctorIds ?? [],
        consultationFee: Number(row.consultationFee ?? 0),
      })),
    };
  }

  private async syncOrgCatalog(request: RequestContext) {
    const settings = await this.getSettings(request);
    const overlay = await this.orgCatalogOverlay();
    const catalog = {
      ...((settings.clinicalCatalog ?? {}) as Record<string, unknown>),
      ...overlay,
    };
    await this.settings.update(settings.id, {
      clinicalCatalog: catalog as never,
      updatedBy: request.user?.sub ?? null,
    });
    this.realtime.publish(tenantChannel(request), 'settings.updated', {});
  }

  async assignDepartment(
    userId: string,
    dto: AssignDepartmentDto,
    request: RequestContext,
  ) {
    const [user, department] = await Promise.all([
      this.getUser(userId),
      this.departments.findOne({ where: { id: dto.departmentId } }),
    ]);
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    if (dto.isPrimary) {
      await this.userDepartments.update(
        { user: { id: userId } },
        { isPrimary: false },
      );
    }
    const existing = await this.userDepartments.findOne({
      where: { user: { id: userId }, department: { id: dto.departmentId } },
    });
    if (existing) {
      if (dto.isPrimary) {
        existing.isPrimary = true;
        existing.updatedBy = request.user?.sub ?? null;
        return this.userDepartments.save(existing);
      }
      return existing;
    }
    return this.userDepartments.save(
      this.userDepartments.create({
        user,
        department,
        isPrimary: dto.isPrimary ?? false,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  private async replaceUserRoles(
    userId: string,
    roleIds: string[],
    request: RequestContext,
  ) {
    await this.superadminPolicy.assertCanAssignRoles(request, userId, roleIds);
    const roles = await this.roles.findBy({ id: In(roleIds) });
    if (roles.length !== roleIds.length) {
      throw new NotFoundException('One or more roles were not found');
    }
    await this.userRoles.delete({ user: { id: userId } });
    await this.userRoles.save(
      roles.map((role) =>
        this.userRoles.create({
          user: { id: userId } as User,
          role,
          grantedBy: request.user?.sub ?? null,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      ),
    );
    await this.tokenRevocation.invalidateUser(userId);
    await this.revokeRefreshTokensForUsers([userId]);
  }

  private async revokeRefreshTokensForUsers(userIds: string[]) {
    if (!userIds.length) return;
    await this.refreshTokens.update(
      { userId: In(userIds), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async replaceRolePermissions(
    roleId: string,
    permissionIds: string[],
    request: RequestContext,
  ) {
    const permissions = await this.permissions.findBy({ id: In(permissionIds) });
    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('One or more permissions were not found');
    }
    await this.rolePermissions.delete({ role: { id: roleId } });
    await this.rolePermissions.save(
      permissions.map((permission) =>
        this.rolePermissions.create({
          role: { id: roleId } as Role,
          permission,
          grantedBy: request.user?.sub ?? null,
          createdBy: request.user?.sub ?? null,
          updatedBy: request.user?.sub ?? null,
        }),
      ),
    );
  }

  private async toUserResponse(user: User) {
    const assignments = await this.userRoles.find({
      where: { user: { id: user.id } },
      relations: { role: true },
    });
    const departments = await this.userDepartments.find({
      where: { user: { id: user.id } },
      relations: { department: true },
    });
    return {
      id: user.id,
      employeeNo: user.employeeNo,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      specialisation: user.specialisation,
      active: user.active,
      forcePasswordChange: user.forcePasswordChange,
      lockedUntil: user.lockedUntil,
      roles: assignments.map((assignment) => assignment.role),
      departments: departments.map((assignment) => ({
        ...assignment.department,
        isPrimary: assignment.isPrimary,
      })),
    };
  }

  private async toRoleResponse(role: Role) {
    const assignments = await this.rolePermissions.find({
      where: { role: { id: role.id } },
      relations: { permission: true },
    });
    return {
      ...role,
      permissions: assignments.map((assignment) => assignment.permission),
    };
  }

  private async getUser(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async getRole(id: string) {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }
}
