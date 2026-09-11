import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { RequestContext } from '../../common/request-context';
import { Permission, Role, User, UserRole } from '../core.entities';
import {
  ADMINISTRATOR_ROLE_NAME,
  PROTECTED_ADMIN_PERMISSION_KEYS,
  SUPERADMIN_ROLE_NAME,
} from './rbac.constants';

@Injectable()
export class SuperadminPolicyService {
  constructor(
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
  ) {}

  isActorSuperadmin(request: RequestContext): boolean {
    return this.hasRole(request.user?.roles, SUPERADMIN_ROLE_NAME);
  }

  assertActorIsSuperadmin(request: RequestContext, message?: string): void {
    if (!this.isActorSuperadmin(request)) {
      throw new ForbiddenException(
        message ?? 'Platform superadmin privileges are required for this action',
      );
    }
  }

  async assertCanAssignRoles(
    request: RequestContext,
    targetUserId: string,
    roleIds: string[],
  ): Promise<void> {
    if (!roleIds.length) {
      throw new BadRequestException('At least one role is required');
    }
    const roles = await this.roles.findBy({ id: In(roleIds) });
    if (roles.length !== roleIds.length) {
      throw new NotFoundException('One or more roles were not found');
    }

    const assignsSuperadmin = roles.some((r) => r.name === SUPERADMIN_ROLE_NAME);
    const targetIsSuperadmin = await this.userHasRole(targetUserId, SUPERADMIN_ROLE_NAME);
    const actorIsSuperadmin = this.isActorSuperadmin(request);

    if (assignsSuperadmin && !actorIsSuperadmin) {
      throw new ForbiddenException('Only a superadmin can assign the superadmin role');
    }

    if (targetIsSuperadmin && !actorIsSuperadmin) {
      throw new ForbiddenException('Only a superadmin can change roles for this account');
    }

    const superadminRole = await this.roles.findOne({
      where: { name: SUPERADMIN_ROLE_NAME },
    });
    if (!superadminRole) {
      return;
    }

    const target = await this.users.findOne({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const willHaveSuperadmin = roleIds.includes(superadminRole.id);
    const willBeActiveSuperadmin = target.active && willHaveSuperadmin;
    const isActiveSuperadminNow =
      target.active && (await this.userHasRole(targetUserId, SUPERADMIN_ROLE_NAME));

    if (isActiveSuperadminNow && !willBeActiveSuperadmin) {
      const others = await this.countActiveSuperadmins(targetUserId);
      if (others === 0) {
        throw new ForbiddenException(
          'Cannot remove the last active superadmin account from the superadmin role',
        );
      }
    }
  }

  async assertCanChangeUserActive(
    request: RequestContext,
    targetUserId: string,
    active: boolean,
  ): Promise<void> {
    const targetIsSuperadmin = await this.userHasRole(targetUserId, SUPERADMIN_ROLE_NAME);
    if (targetIsSuperadmin && !this.isActorSuperadmin(request)) {
      throw new ForbiddenException('Only a superadmin can activate or deactivate this account');
    }
    if (request.user?.sub === targetUserId && !active) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    if (targetIsSuperadmin && !active) {
      const others = await this.countActiveSuperadmins(targetUserId);
      if (others === 0) {
        throw new ForbiddenException(
          'Cannot deactivate the last active superadmin account',
        );
      }
    }
  }

  async assertCanUnlockUser(
    request: RequestContext,
    targetUserId: string,
  ): Promise<void> {
    const targetIsSuperadmin = await this.userHasRole(
      targetUserId,
      SUPERADMIN_ROLE_NAME,
    );
    if (targetIsSuperadmin && !this.isActorSuperadmin(request)) {
      throw new ForbiddenException('Only a superadmin can unlock this account');
    }
  }

  async assertCanUpdateRolePermissions(
    request: RequestContext,
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    const role = await this.roles.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.name === SUPERADMIN_ROLE_NAME || role.name === ADMINISTRATOR_ROLE_NAME) {
      this.assertActorIsSuperadmin(
        request,
        'Only a superadmin can modify permissions on system administrator roles',
      );
    }

    if (role.name === SUPERADMIN_ROLE_NAME) {
      const permissions = await this.permissions.findBy({ id: In(permissionIds) });
      const keys = new Set(permissions.map((p) => p.permissionKey));
      for (const required of PROTECTED_ADMIN_PERMISSION_KEYS) {
        if (!keys.has(required)) {
          throw new ForbiddenException(
            `The superadmin role must retain ${required}`,
          );
        }
      }
    }

    if (role.name === ADMINISTRATOR_ROLE_NAME) {
      const permissions = await this.permissions.findBy({ id: In(permissionIds) });
      const keys = new Set(permissions.map((p) => p.permissionKey));
      for (const required of ['users:manage', 'roles:manage', 'settings:manage'] as const) {
        if (!keys.has(required)) {
          throw new ForbiddenException(
            `The hospital administrator role must retain ${required}`,
          );
        }
      }
    }
  }

  assertCanCreateRole(request: RequestContext, name: string): void {
    const normalized = name.toLowerCase().replace(/\s+/g, '_');
    if (normalized === SUPERADMIN_ROLE_NAME && !this.isActorSuperadmin(request)) {
      throw new ForbiddenException('Only a superadmin can create a superadmin role');
    }
  }

  filterAssignableRoles<T extends { name: string }>(
    request: RequestContext,
    roles: T[],
  ): T[] {
    if (this.isActorSuperadmin(request)) {
      return roles;
    }
    return roles.filter((role) => role.name !== SUPERADMIN_ROLE_NAME);
  }

  async userHasRole(userId: string, roleName: string): Promise<boolean> {
    const count = await this.userRoles
      .createQueryBuilder('ur')
      .innerJoin('ur.role', 'role')
      .where('ur.user_id = :userId', { userId })
      .andWhere('role.name = :roleName', { roleName })
      .getCount();
    return count > 0;
  }

  async countActiveSuperadmins(excludeUserId?: string): Promise<number> {
    const qb = this.users
      .createQueryBuilder('user')
      .innerJoin(UserRole, 'ur', 'ur.user_id = user.id')
      .innerJoin(Role, 'role', 'role.id = ur.role_id')
      .where('role.name = :roleName', { roleName: SUPERADMIN_ROLE_NAME })
      .andWhere('user.active = true');

    if (excludeUserId) {
      qb.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    return qb.getCount();
  }

  private hasRole(roles: string[] | undefined, roleName: string): boolean {
    return (roles ?? []).includes(roleName);
  }
}
