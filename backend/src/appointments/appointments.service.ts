import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { defaultTenantCode, tenantChannel } from '../common/tenant-defaults';
import { Clinic } from '../core/core.entities';
import { Patient } from '../patients/patient.entities';
import { Encounter } from '../opd/opd.entities';
import { OpdService } from '../opd/opd.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Appointment, AppointmentSlot } from './appointment.entities';
import {
  CreateAppointmentDto,
  CreateSlotDto,
  PublicBookAppointmentDto,
  UpdateAppointmentStatusDto,
  UpdateSlotDto,
} from './appointments.dto';
import { formatWebsiteReason } from './website-booking';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(AppointmentSlot)
    private readonly slots: Repository<AppointmentSlot>,
    @InjectRepository(Appointment)
    private readonly appointments: Repository<Appointment>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
    @InjectRepository(Clinic)
    private readonly clinics: Repository<Clinic>,
    private readonly opdService: OpdService,
    private readonly notifications: NotificationsService,
  ) {}

  createSlot(dto: CreateSlotDto, request: RequestContext) {
    return this.slots.save(
      this.slots.create({
        doctorId: dto.doctorId,
        doctor: { id: dto.doctorId } as never,
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        maxPatients: dto.maxPatients ?? 1,
        available: true,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listSlots(doctorId?: string, date?: string) {
    const where: { doctorId?: string; date?: string; available: boolean } = { available: true };
    if (doctorId) where.doctorId = doctorId;
    if (date) where.date = date;
    return this.slots.find({
      where,
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  async updateSlot(id: string, dto: UpdateSlotDto, request: RequestContext) {
    await this.slots.update(id, {
      ...dto,
      updatedBy: request.user?.sub ?? null,
    });
    return this.slots.findOneOrFail({ where: { id } });
  }

  async createAppointment(dto: CreateAppointmentDto, request: RequestContext) {
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    const slot = dto.slotId
      ? await this.slots.findOne({ where: { id: dto.slotId } })
      : null;
    if (slot) await this.assertSlotHasCapacity(slot.id, slot.maxPatients);
    const sourceEncounter = dto.sourceEncounterId
      ? await this.encounters.findOne({ where: { id: dto.sourceEncounterId } })
      : null;

    let reason = dto.reason.trim();
    if (dto.clinicId) {
      const clinic = await this.clinics.findOne({
        where: { id: dto.clinicId },
        relations: { department: true },
      });
      if (!clinic?.active) {
        throw new BadRequestException('Clinic not found or inactive');
      }
      const assigned = clinic.doctorIds ?? [];
      if (!assigned.includes(dto.doctorId)) {
        throw new BadRequestException(
          'That doctor is not assigned to the selected clinic. Assign them under Departments & clinics.',
        );
      }
      const specialty = clinic.department?.name;
      reason = specialty
        ? `${clinic.name} (${specialty}): ${reason}`
        : `${clinic.name}: ${reason}`;
    }

    const appointment = await this.appointments.save(
      this.appointments.create({
        patient,
        doctorId: dto.doctorId,
        doctor: { id: dto.doctorId } as never,
        slot,
        appointmentDate: dto.appointmentDate,
        appointmentTime: dto.appointmentTime,
        type: dto.type,
        reason,
        status: 'scheduled',
        sourceEncounter,
        linkedEncounter: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
    await this.notifications.notifyUsers([dto.doctorId], {
      title: 'Appointment booked',
      body: `${patient.firstName} ${patient.lastName} on ${dto.appointmentDate} at ${dto.appointmentTime}`,
      severity: 'info',
      link: '/appointments',
      createdBy: request.user?.sub ?? null,
      tenantCode: tenantChannel(request),
    });
    return appointment;
  }

  listAppointments(status?: string, date?: string) {
    const where: { status?: Appointment['status']; appointmentDate?: string } = {};
    if (status) where.status = status as Appointment['status'];
    if (date) where.appointmentDate = date;
    return this.appointments.find({
      where,
      relations: { patient: true, doctor: true, slot: true },
      order: { appointmentDate: 'ASC', appointmentTime: 'ASC' },
      take: 100,
    });
  }

  today() {
    return this.listAppointments(undefined, new Date().toISOString().slice(0, 10));
  }

  async updateStatus(
    id: string,
    dto: UpdateAppointmentStatusDto,
    request: RequestContext,
  ) {
    await this.appointments.update(id, {
      status: dto.status,
      updatedBy: request.user?.sub ?? null,
    });
    return this.appointments.findOneOrFail({ where: { id } });
  }

  async markArrived(id: string, request: RequestContext) {
    const appointment = await this.appointments.findOne({
      where: { id },
      relations: { patient: true },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    const encounter = await this.opdService.createEncounter(
      {
        patientId: appointment.patient.id,
        presentingComplaint: appointment.reason,
        visitType: appointment.type === 'follow_up' ? 'follow_up' : 'new',
      },
      request,
    );
    await this.appointments.update(id, {
      status: 'arrived',
      linkedEncounter: encounter,
      updatedBy: request.user?.sub ?? null,
    });
    return { appointmentId: id, encounter };
  }

  async listPublicSlots(date?: string) {
    const day = date?.trim() || new Date().toISOString().slice(0, 10);
    const slots = await this.slots.find({
      where: { date: day, available: true },
      relations: { doctor: true },
      order: { startTime: 'ASC' },
    });
    const open: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      remaining: number;
      doctorName: string;
    }> = [];
    for (const slot of slots) {
      const remaining = await this.slotRemaining(slot.id, slot.maxPatients);
      if (remaining <= 0) continue;
      const doctorName = slot.doctor
        ? `${slot.doctor.firstName} ${slot.doctor.lastName}`.trim()
        : 'Clinic';
      open.push({
        id: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        remaining,
        doctorName,
      });
    }
    return open;
  }

  async createWebsiteAppointment(dto: PublicBookAppointmentDto) {
    const patient = await this.findRegisteredPatient(dto.hospitalNumberOrPhone);
    const slot = await this.slots.findOne({
      where: { id: dto.slotId, available: true },
      relations: { doctor: true },
    });
    if (!slot) throw new NotFoundException('That clinic slot is not available.');
    await this.assertSlotHasCapacity(slot.id, slot.maxPatients);
    const appointment = await this.appointments.save(
      this.appointments.create({
        patient,
        doctorId: slot.doctorId,
        doctor: { id: slot.doctorId } as never,
        slot,
        appointmentDate: slot.date,
        appointmentTime: slot.startTime,
        type: dto.type,
        reason: formatWebsiteReason(dto.reason),
        status: 'scheduled',
        sourceEncounter: null,
        linkedEncounter: null,
        createdBy: null,
        updatedBy: null,
      }),
    );
    await this.notifications.notifyUsers([slot.doctorId], {
      title: 'Website appointment',
      body: `${patient.firstName} ${patient.lastName} booked ${slot.date} at ${slot.startTime} from the hospital website.`,
      severity: 'info',
      link: '/appointments',
      createdBy: null,
      tenantCode: defaultTenantCode(),
    });
    return {
      appointmentId: appointment.id,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientNo: patient.patientNo,
      doctorName: slot.doctor
        ? `${slot.doctor.firstName} ${slot.doctor.lastName}`.trim()
        : 'Clinic',
    };
  }

  private async assertSlotHasCapacity(slotId: string, maxPatients: number) {
    const remaining = await this.slotRemaining(slotId, maxPatients);
    if (remaining <= 0) {
      throw new BadRequestException('That clinic slot is full. Choose another time.');
    }
  }

  private async slotRemaining(slotId: string, maxPatients: number) {
    const taken = await this.appointments.count({
      where: {
        slot: { id: slotId },
        status: In(['scheduled', 'confirmed', 'arrived']),
      },
    });
    return Math.max(0, maxPatients - taken);
  }

  private async findRegisteredPatient(query: string) {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      throw new BadRequestException('Enter the hospital number or the phone used at registration.');
    }
    const exact = await this.patients.findOne({ where: { patientNo: trimmed } });
    if (exact) return exact;
    const upper = await this.patients.findOne({ where: { patientNo: trimmed.toUpperCase() } });
    if (upper) return upper;
    const phoneTail = trimmed.replace(/\D/g, '').slice(-9);
    if (phoneTail.length >= 9) {
      const byPhone = await this.patients
        .createQueryBuilder('patient')
        .where('patient.deleted_at IS NULL')
        .andWhere(
          `regexp_replace(coalesce(patient.primary_phone, ''), '\\D', '', 'g') LIKE :phoneTail`,
          { phoneTail: `%${phoneTail}` },
        )
        .getOne();
      if (byPhone) return byPhone;
    }
    throw new NotFoundException(
      'No registered patient matches that hospital number or phone. Register at reception, then book.',
    );
  }
}
