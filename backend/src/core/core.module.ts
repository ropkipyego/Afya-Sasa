import { Module } from '@nestjs/common';
import { TenancyModule } from './tenancy/tenancy.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { PlatformModule } from './platform/platform.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    TenancyModule,
    AuthModule,
    UsersModule,
    RbacModule,
    AuditModule,
    AdminModule,
    PlatformModule,
    CacheModule,
  ],
  exports: [TenancyModule, AuthModule, UsersModule, RbacModule, AuditModule, PlatformModule, CacheModule],
})
export class CoreModule {}
