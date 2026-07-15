import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant, TenantSettings } from '../core.entities';
import { TenancyService } from './tenancy.service';
import { TenantPoolInitializer } from './tenant-pool.initializer';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantSettings])],
  providers: [TenancyService, TenantPoolInitializer],
  exports: [TenancyService],
})
export class TenancyModule {}
