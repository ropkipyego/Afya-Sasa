import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission, Role, RolePermission, User, UserRole } from '../core.entities';
import { RbacService } from './rbac.service';
import { SuperadminPolicyService } from './superadmin-policy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, RolePermission, User, UserRole]),
  ],
  providers: [RbacService, SuperadminPolicyService],
  exports: [RbacService, SuperadminPolicyService],
})
export class RbacModule {}
