import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Patient } from '../patients/patient.entities';
import { Encounter } from '../opd/opd.entities';
import { OpdService } from '../opd/opd.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Appointment, AppointmentSlot } from './appointment.entities';
import {
  CreateAppointmentDto,
  CreateSlotDto,
  UpdateAppointmentStatusDto,
  UpdateSlotDto,
} from './appointments.dto';

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
    const sourceEncounter = dto.sourceEncounterId
      ? await this.encounters.findOne({ where: { id: dto.sourceEncounterId } })
      : null;
    const appointment = await this.appointments.save(
      this.appointments.create({
        patient,
        doctorId: dto.doctorId,
        doctor: { id: dto.doctorId } as never,
        slot,
        appointmentDate: dto.appointmentDate,
        appointmentTime: dto.appointmentTime,
        type: dto.type,
        reason: dto.reason,
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
      tenantCode: request.tenant?.code ?? 'demo',
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
}
