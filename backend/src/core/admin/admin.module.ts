import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  Department,
  Permission,
  RefreshToken,
  Role,
  RolePermission,
  TenantSettings,
  User,
  UserDepartment,
  UserRole,
} from '../core.entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    AuthModule,
    RbacModule,
    TypeOrmModule.forFeature([
      User,
      Role,
      Permission,
      UserRole,
      Department,
      UserDepartment,
      RolePermission,
      AuditLog,
      TenantSettings,
      RefreshToken,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
