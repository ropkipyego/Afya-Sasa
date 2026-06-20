import { Module } from '@nestjs/common';
import { TenancyModule } from './tenancy/tenancy.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [TenancyModule, AuthModule, UsersModule, RbacModule, AuditModule],
  exports: [TenancyModule, AuthModule, UsersModule, RbacModule, AuditModule],
})
export class CoreModule {}
