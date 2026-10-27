import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../core/auth/auth.decorators';
import { PublicBookAppointmentDto } from './appointments.dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('Public appointments')
@Controller('public/appointments')
@UseGuards(ThrottlerGuard)
export class PublicAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Public()
  @Get('slots')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  listSlots(@Query('date') date?: string) {
    return this.appointments.listPublicSlots(date);
  }

  @Public()
  @Post()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  book(@Body() dto: PublicBookAppointmentDto) {
    return this.appointments.createWebsiteAppointment(dto);
  }
}
