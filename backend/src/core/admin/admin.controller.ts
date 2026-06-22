import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../../common/request-context';
import { RequirePermissions } from '../auth/auth.decorators';
import {
  AssignRolesDto,
  AssignDepartmentDto,
  CreateDepartmentDto,
  CreateRoleDto,
  CreateUserDto,
  UpdateRolePermissionsDto,
  UpdateSettingsDto,
  UpdateUserDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@ApiBearerAuth()
@ApiTags('Administration')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @RequirePermissions('users:manage')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Post('users')
  @RequirePermissions('users:manage')
  createUser(@Body() dto: CreateUserDto, @Req() request: RequestContext) {
    return this.adminService.createUser(dto, request);
  }

  @Patch('users/:id')
  @RequirePermissions('users:manage')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: RequestContext,
  ) {
    return this.adminService.updateUser(id, dto, request);
  }

  @Post('users/:id/activate')
  @RequirePermissions('users:manage')
  activateUser(@Param('id') id: string) {
    return this.adminService.setUserActive(id, true);
  }

  @Post('users/:id/deactivate')
  @RequirePermissions('users:manage')
  deactivateUser(@Param('id') id: string) {
    return this.adminService.setUserActive(id, false);
  }

  @Post('users/:id/unlock')
  @RequirePermissions('users:manage')
  unlockUser(@Param('id') id: string) {
    return this.adminService.unlockUser(id);
  }

  @Post('users/:id/roles')
  @RequirePermissions('users:manage')
  assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
    @Req() request: RequestContext,
  ) {
    return this.adminService.assignRoles(id, dto, request);
  }

  @Get('roles')
  @RequirePermissions('roles:manage')
  listRoles() {
    return this.adminService.listRoles();
  }

  @Post('roles')
  @RequirePermissions('roles:manage')
  createRole(@Body() dto: CreateRoleDto, @Req() request: RequestContext) {
    return this.adminService.createRole(dto, request);
  }

  @Patch('roles/:id/permissions')
  @RequirePermissions('roles:manage')
  updateRolePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @Req() request: RequestContext,
  ) {
    return this.adminService.updateRolePermissions(id, dto, request);
  }

  @Get('permissions')
  @RequirePermissions('roles:manage')
  listPermissions() {
    return this.adminService.listPermissions();
  }

  @Get('settings')
  @RequirePermissions('settings:manage')
  getSettings(@Req() request: RequestContext) {
    return this.adminService.getSettings(request);
  }

  @Get('clinical-catalog')
  @RequirePermissions('encounters:create')
  getClinicalCatalog(@Req() request: RequestContext) {
    return this.adminService.getClinicalCatalog(request);
  }

  @Patch('settings')
  @RequirePermissions('settings:manage')
  updateSettings(
    @Body() dto: UpdateSettingsDto,
    @Req() request: RequestContext,
  ) {
    return this.adminService.updateSettings(dto, request);
  }

  @Get('audit-logs')
  @RequirePermissions('audit_logs:read')
  listAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('recordType') recordType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.listAuditLogs({
      userId,
      action,
      recordType,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('departments')
  @RequirePermissions('departments:manage')
  listDepartments() {
    return this.adminService.listDepartments();
  }

  @Post('departments')
  @RequirePermissions('departments:manage')
  createDepartment(
    @Body() dto: CreateDepartmentDto,
    @Req() request: RequestContext,
  ) {
    return this.adminService.createDepartment(dto, request);
  }

  @Post('users/:id/departments')
  @RequirePermissions('departments:manage')
  assignDepartment(
    @Param('id') id: string,
    @Body() dto: AssignDepartmentDto,
    @Req() request: RequestContext,
  ) {
    return this.adminService.assignDepartment(id, dto, request);
  }
}
