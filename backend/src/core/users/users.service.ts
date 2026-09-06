import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Permission,
  RolePermission,
  User,
  UserRole,
} from '../core.entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissions: Repository<RolePermission>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  async collectRolesAndPermissions(userId: string): Promise<{
    roles: string[];
    permissions: string[];
  }> {
    const rows = await this.userRoles
      .createQueryBuilder('ur')
      .innerJoin('ur.role', 'role')
      .leftJoin(RolePermission, 'rp', 'rp.role_id = role.id')
      .leftJoin(Permission, 'perm', 'perm.id = rp.permission_id')
      .where('ur.user_id = :userId', { userId })
      .select('role.name', 'roleName')
      .addSelect('perm.permission_key', 'permissionKey')
      .getRawMany<{ roleName: string; permissionKey: string | null }>();

    const roles = [...new Set(rows.map((row) => row.roleName).filter(Boolean))];
    const permissions = [
      ...new Set(
        rows
          .map((row) => row.permissionKey)
          .filter((key): key is string => Boolean(key)),
      ),
    ];

    return { roles, permissions };
  }

  async recordSuccessfulLogin(user: User): Promise<void> {
    await this.users.update(user.id, {
      failedLoginAttempts: 0,
      lastLoginAt: new Date(),
      lockedUntil: null,
    });
  }

  async recordFailedLogin(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

    await this.users.update(user.id, {
      failedLoginAttempts: attempts,
      lockedUntil,
    });
  }
}
