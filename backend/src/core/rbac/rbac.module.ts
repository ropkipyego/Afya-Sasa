import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission, Role, RolePermission } from '../core.entities';
import { RbacService } from './rbac.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission])],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
