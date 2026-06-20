import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, Repository } from 'typeorm';
import type { RequestContext } from '../../common/request-context';
import {
  AuditLog,
  Permission,
  Role,
  RolePermission,
  TenantSettings,
  User,
  UserRole,
} from '../core.entities';
import {
  AssignRolesDto,
  CreateRoleDto,
  CreateUserDto,
  UpdateRolePermissionsDto,
  UpdateSettingsDto,
  UpdateUserDto,
} from './admin.dto';

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
  ) {}

  async listUsers() {
    const users = await this.users.find({ order: { createdAt: 'DESC' } });
    return Promise.all(users.map((user) => this.toUserResponse(user)));
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
    await this.users.update(id, {
      employeeNo: dto.employeeNo,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email?.toLowerCase(),
      phone: dto.phone,
      active: dto.active,
      passwordHash: dto.temporaryPassword
        ? await bcrypt.hash(dto.temporaryPassword, 12)
        : undefined,
      forcePasswordChange: dto.temporaryPassword ? true : undefined,
      updatedBy: request.user?.sub ?? null,
    });
    if (dto.roleIds) {
      await this.replaceUserRoles(id, dto.roleIds, request);
    }
    return this.toUserResponse(await this.getUser(id));
  }

  async setUserActive(id: string, active: boolean) {
    await this.getUser(id);
    await this.users.update(id, { active });
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
    await this.replaceRolePermissions(id, dto.permissionIds, request);
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

  async updateSettings(dto: UpdateSettingsDto, request: RequestContext) {
    const current = await this.getSettings(request);
    await this.settings.update(current.id, {
      smsSenderName: dto.smsSenderName,
      patientIdPrefix: dto.patientIdPrefix,
      triageSystem: dto.triageSystem,
      updatedBy: request.user?.sub ?? null,
    });
    return this.getSettings(request);
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
    const [items, total] = await this.auditLogs.findAndCount({
      where: {
        userId: params.userId,
        action: params.action,
        recordType: params.recordType,
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, meta: { page, pageSize, total } };
  }

  private async replaceUserRoles(
    userId: string,
    roleIds: string[],
    request: RequestContext,
  ) {
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
    return {
      id: user.id,
      employeeNo: user.employeeNo,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      active: user.active,
      forcePasswordChange: user.forcePasswordChange,
      lockedUntil: user.lockedUntil,
      roles: assignments.map((assignment) => assignment.role),
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
