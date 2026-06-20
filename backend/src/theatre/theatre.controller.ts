import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import {
  AssignSurgeryStaffDto,
  CreateSurgeryBookingDto,
  CreateSurgeryComplicationDto,
  CreateSurgeryNoteDto,
  CreateSurgicalProcedureDto,
  CreateTheatreDto,
  UpdateSurgeryBookingStatusDto,
  UpdateTheatreDto,
} from './theatre.dto';
import { TheatreService } from './theatre.service';

@ApiBearerAuth()
@ApiTags('Theatre')
@Controller('theatre')
export class TheatreController {
  constructor(private readonly theatreService: TheatreService) {}

  @Get('theatres')
  @RequirePermissions('theatres:read')
  listTheatres() {
    return this.theatreService.listTheatres();
  }

  @Post('theatres')
  @RequirePermissions('theatres:manage')
  createTheatre(@Body() dto: CreateTheatreDto, @Req() request: RequestContext) {
    return this.theatreService.createTheatre(dto, request);
  }

  @Patch('theatres/:id')
  @RequirePermissions('theatres:manage')
  updateTheatre(@Param('id') id: string, @Body() dto: UpdateTheatreDto, @Req() request: RequestContext) {
    return this.theatreService.updateTheatre(id, dto, request);
  }

  @Get('procedures')
  @RequirePermissions('surgical_procedures:read')
  listProcedures() {
    return this.theatreService.listProcedures();
  }

  @Post('procedures')
  @RequirePermissions('surgical_procedures:manage')
  createProcedure(@Body() dto: CreateSurgicalProcedureDto, @Req() request: RequestContext) {
    return this.theatreService.createProcedure(dto, request);
  }

  @Get('bookings')
  @RequirePermissions('surgery_bookings:read')
  listBookings(@Query('status') status?: string) {
    return this.theatreService.listBookings(status);
  }

  @Post('bookings')
  @RequirePermissions('surgery_bookings:create')
  createBooking(@Body() dto: CreateSurgeryBookingDto, @Req() request: RequestContext) {
    return this.theatreService.createBooking(dto, request);
  }

  @Patch('bookings/:id/status')
  @RequirePermissions('surgery_bookings:update')
  updateBookingStatus(@Param('id') id: string, @Body() dto: UpdateSurgeryBookingStatusDto, @Req() request: RequestContext) {
    return this.theatreService.updateBookingStatus(id, dto, request);
  }

  @Post('bookings/:id/staff')
  @RequirePermissions('surgery_staff:assign')
  assignStaff(@Param('id') id: string, @Body() dto: AssignSurgeryStaffDto, @Req() request: RequestContext) {
    return this.theatreService.assignStaff(id, dto, request);
  }

  @Post('bookings/:id/notes')
  @RequirePermissions('surgery_notes:create')
  addNote(@Param('id') id: string, @Body() dto: CreateSurgeryNoteDto, @Req() request: RequestContext) {
    return this.theatreService.addNote(id, dto, request);
  }

  @Post('bookings/:id/complications')
  @RequirePermissions('surgery_complications:create')
  addComplication(@Param('id') id: string, @Body() dto: CreateSurgeryComplicationDto, @Req() request: RequestContext) {
    return this.theatreService.addComplication(id, dto, request);
  }
}
