import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant, TenantSettings } from '../core.entities';
import { TenantProvisioningService } from '../tenancy/tenant-provisioning.service';
import { PlatformController } from './platform.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantSettings])],
  controllers: [PlatformController],
  providers: [TenantProvisioningService],
  exports: [TenantProvisioningService],
})
export class PlatformModule {}
