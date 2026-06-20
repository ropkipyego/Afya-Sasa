import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  CreateAppointmentDto,
  CreateSlotDto,
  UpdateAppointmentStatusDto,
  UpdateSlotDto,
} from './appointments.dto';
import { AppointmentsService } from './appointments.service';

@ApiBearerAuth()
@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('slots')
  @RequirePermissions('appointments:read')
  listSlots(@Query('doctorId') doctorId?: string, @Query('date') date?: string) {
    return this.appointmentsService.listSlots(doctorId, date);
  }

  @Post('slots')
  @RequirePermissions('appointments:manage')
  createSlot(@Body() dto: CreateSlotDto, @Req() request: RequestContext) {
    return this.appointmentsService.createSlot(dto, request);
  }

  @Patch('slots/:id')
  @RequirePermissions('appointments:manage')
  updateSlot(
    @Param('id') id: string,
    @Body() dto: UpdateSlotDto,
    @Req() request: RequestContext,
  ) {
    return this.appointmentsService.updateSlot(id, dto, request);
  }

  @Get()
  @RequirePermissions('appointments:read')
  listAppointments(
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.appointmentsService.listAppointments(status, date);
  }

  @Get('today')
  @RequirePermissions('appointments:read')
  today() {
    return this.appointmentsService.today();
  }

  @Post()
  @RequirePermissions('appointments:manage')
  createAppointment(
    @Body() dto: CreateAppointmentDto,
    @Req() request: RequestContext,
  ) {
    return this.appointmentsService.createAppointment(dto, request);
  }

  @Patch(':id/status')
  @RequirePermissions('appointments:manage')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @Req() request: RequestContext,
  ) {
    return this.appointmentsService.updateStatus(id, dto, request);
  }

  @Post(':id/arrived')
  @RequirePermissions('appointments:manage')
  markArrived(@Param('id') id: string, @Req() request: RequestContext) {
    return this.appointmentsService.markArrived(id, request);
  }
}
