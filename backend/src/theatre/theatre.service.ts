import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import {
  SurgicalProcedure,
  SurgeryBooking,
  SurgeryComplication,
  SurgeryNote,
  SurgeryStaff,
  Theatre,
} from './theatre.entities';
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

@Injectable()
export class TheatreService {
  constructor(
    @InjectRepository(Theatre) private readonly theatres: Repository<Theatre>,
    @InjectRepository(SurgicalProcedure)
    private readonly procedures: Repository<SurgicalProcedure>,
    @InjectRepository(SurgeryBooking)
    private readonly bookings: Repository<SurgeryBooking>,
    @InjectRepository(SurgeryStaff)
    private readonly staff: Repository<SurgeryStaff>,
    @InjectRepository(SurgeryNote) private readonly notes: Repository<SurgeryNote>,
    @InjectRepository(SurgeryComplication)
    private readonly complications: Repository<SurgeryComplication>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
  ) {}

  createTheatre(dto: CreateTheatreDto, request: RequestContext) {
    return this.theatres.save(
      this.theatres.create({
        ...dto,
        location: dto.location ?? null,
        status: 'available',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listTheatres() {
    return this.theatres.find({ order: { name: 'ASC' } });
  }

  async updateTheatre(id: string, dto: UpdateTheatreDto, request: RequestContext) {
    await this.theatres.update(id, { ...dto, updatedBy: request.user?.sub ?? null });
    return this.theatres.findOneOrFail({ where: { id } });
  }

  createProcedure(dto: CreateSurgicalProcedureDto, request: RequestContext) {
    return this.procedures.save(
      this.procedures.create({
        ...dto,
        category: dto.category ?? null,
        description: dto.description ?? null,
        expectedDurationMinutes: dto.expectedDurationMinutes ?? null,
        active: true,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listProcedures() {
    return this.procedures.find({ where: { active: true }, order: { name: 'ASC' } });
  }

  async importProcedures(csv: string, request: RequestContext) {
    const rows = csv
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (rows.length < 2) {
      throw new BadRequestException('CSV is empty or missing a header row.');
    }
    const headers = rows[0].split(',').map((header) => header.trim().toLowerCase().replace(/\s+/g, '_'));
    const summary = { created: 0, skipped: 0, errors: [] as string[] };
    for (const [index, line] of rows.slice(1).entries()) {
      const cells = line.split(',').map((cell) => cell.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, cellIndex) => {
        row[header] = cells[cellIndex] ?? '';
      });
      const code = (row.code ?? '').trim().toUpperCase();
      const name = (row.name ?? '').trim();
      if (!code || !name) {
        summary.errors.push(`Line ${index + 2}: code and name are required.`);
        continue;
      }
      const existing = await this.procedures.findOne({ where: { code } });
      if (existing) {
        summary.skipped += 1;
        continue;
      }
      const duration = Number(row.expected_duration_minutes ?? row.duration ?? '');
      await this.createProcedure(
        {
          code,
          name,
          category: row.category?.trim() || undefined,
          description: row.description?.trim() || undefined,
          expectedDurationMinutes: Number.isFinite(duration) && duration > 0 ? duration : undefined,
        },
        request,
      );
      summary.created += 1;
    }
    return summary;
  }

  async createBooking(dto: CreateSurgeryBookingDto, request: RequestContext) {
    const [patient, procedure, theatre, encounter, admission] = await Promise.all([
      this.patients.findOne({ where: { id: dto.patientId } }),
      this.procedures.findOne({ where: { id: dto.procedureId } }),
      dto.theatreId ? this.theatres.findOne({ where: { id: dto.theatreId } }) : null,
      dto.encounterId ? this.encounters.findOne({ where: { id: dto.encounterId } }) : null,
      dto.admissionId ? this.admissions.findOne({ where: { id: dto.admissionId } }) : null,
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!procedure) throw new NotFoundException('Procedure not found');
    const booking = await this.bookings.save(
      this.bookings.create({
        bookingNo: await this.generateBookingNo(),
        patient,
        procedure,
        theatre,
        encounter,
        admission,
        scheduledStartAt: new Date(dto.scheduledStartAt),
        scheduledEndAt: dto.scheduledEndAt ? new Date(dto.scheduledEndAt) : null,
        actualStartAt: null,
        actualEndAt: null,
        priority: dto.priority,
        status: 'scheduled',
        consentStatus: 'pending',
        checklistStatus: 'pending',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    if (theatre) await this.theatres.update(theatre.id, { status: 'in_use' });
    return booking;
  }

  listBookings(status?: string) {
    const where: { status?: SurgeryBooking['status'] } = {};
    if (status) where.status = status as SurgeryBooking['status'];
    return this.bookings.find({
      where,
      relations: { patient: true, theatre: true, procedure: true, admission: true },
      order: { scheduledStartAt: 'DESC' },
    });
  }

  async updateBookingStatus(
    id: string,
    dto: UpdateSurgeryBookingStatusDto,
    request: RequestContext,
  ) {
    const booking = await this.bookings.findOne({
      where: { id },
      relations: { theatre: true },
    });
    if (!booking) throw new NotFoundException('Surgery booking not found');
    const update: Partial<SurgeryBooking> = {
      status: dto.status,
      updatedBy: request.user?.sub ?? null,
    };
    if (dto.status === 'in_theatre') update.actualStartAt = new Date();
    if (dto.status === 'completed') update.actualEndAt = new Date();
    await this.bookings.update(id, update);
    if (booking.theatre && dto.status === 'in_theatre') {
      await this.theatres.update(booking.theatre.id, { status: 'in_use' });
    }
    if (
      booking.theatre &&
      (dto.status === 'completed' || dto.status === 'cancelled' || dto.status === 'recovery')
    ) {
      const remaining = await this.bookings.count({
        where: {
          theatre: { id: booking.theatre.id },
          status: In(['scheduled', 'pre_op', 'in_theatre']),
          id: Not(id),
        },
      });
      if (remaining === 0) {
        await this.theatres.update(booking.theatre.id, { status: 'available' });
      }
    }
    return this.bookings.findOneOrFail({ where: { id }, relations: { theatre: true } });
  }

  async assignStaff(id: string, dto: AssignSurgeryStaffDto, request: RequestContext) {
    const booking = await this.getBooking(id);
    return this.staff.save(
      this.staff.create({
        booking,
        user: { id: dto.userId } as never,
        role: dto.role,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async addNote(id: string, dto: CreateSurgeryNoteDto, request: RequestContext) {
    const booking = await this.getBooking(id);
    if (dto.amendsNoteId && !dto.amendmentReason) {
      throw new BadRequestException('Amendment reason is required');
    }
    return this.notes.save(
      this.notes.create({
        booking,
        author: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        amendsNote: dto.amendsNoteId ? ({ id: dto.amendsNoteId } as never) : null,
        type: dto.type,
        body: dto.body,
        amendmentReason: dto.amendmentReason ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async addComplication(
    id: string,
    dto: CreateSurgeryComplicationDto,
    request: RequestContext,
  ) {
    const booking = await this.getBooking(id);
    return this.complications.save(
      this.complications.create({
        booking,
        reportedBy: request.user?.sub ? ({ id: request.user.sub } as never) : null,
        severity: dto.severity,
        description: dto.description,
        actionTaken: dto.actionTaken,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  private async getBooking(id: string) {
    const booking = await this.bookings.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Surgery booking not found');
    return booking;
  }

  private async generateBookingNo() {
    const year = new Date().getFullYear();
    const total = await this.bookings.count();
    return `SURG-${year}-${String(total + 1).padStart(5, '0')}`;
  }
}
