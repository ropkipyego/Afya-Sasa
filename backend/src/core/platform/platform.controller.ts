import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../../common/request-context';
import { RequirePermissions } from '../auth/auth.decorators';
import { TenantProvisioningService } from '../tenancy/tenant-provisioning.service';
import {
  ProvisionTenantDto,
  TenantIdParamDto,
  UpdateTenantStatusDto,
} from './platform.dto';

@ApiBearerAuth()
@ApiTags('Platform')
@Controller('platform/tenants')
export class PlatformController {
  constructor(private readonly provisioning: TenantProvisioningService) {}

  @Get()
  @RequirePermissions('platform:tenants')
  list() {
    return this.provisioning.listTenants();
  }

  @Post('provision')
  @RequirePermissions('platform:tenants')
  provision(@Body() dto: ProvisionTenantDto, @Req() request: RequestContext) {
    return this.provisioning.provision(dto, request);
  }

  @Patch(':id/status')
  @RequirePermissions('platform:tenants')
  setStatus(
    @Param() params: TenantIdParamDto,
    @Body() dto: UpdateTenantStatusDto,
    @Req() request: RequestContext,
  ) {
    return this.provisioning.setActive(params.id, dto.active, request);
  }
}
