import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Permission,
  Role,
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
    const assignments = await this.userRoles.find({
      where: { user: { id: userId } },
      relations: { role: true },
    });
    const roles = assignments.map((assignment) => assignment.role.name);

    if (!roles.length) {
      return { roles: [], permissions: [] };
    }

    const rolePermissions = await this.rolePermissions.find({
      where: assignments.map((assignment) => ({
        role: { id: assignment.role.id } as Role,
      })),
      relations: { permission: true },
    });

    return {
      roles,
      permissions: [
        ...new Set(
          rolePermissions.map(
            (assignment: RolePermission & { permission: Permission }) =>
              assignment.permission.permissionKey,
          ),
        ),
      ],
    };
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
