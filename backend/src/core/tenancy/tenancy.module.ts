import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant, TenantSettings } from '../core.entities';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantSettings])],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
