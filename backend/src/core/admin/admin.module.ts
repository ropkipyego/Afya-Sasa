import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  Department,
  Permission,
  Role,
  RolePermission,
  TenantSettings,
  User,
  UserDepartment,
  UserRole,
} from '../core.entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
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
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
