import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginationQueryDto } from '../common/dto/pagination.dto';
import { normalizePagination, paginatedResult } from '../common/pagination.util';
import { Admission } from '../inpatient/inpatient.entities';
import { LabRequest } from '../laboratory/laboratory.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient, PatientIdentifier } from '../patients/patient.entities';
import { RadiologyRequest } from '../radiology/radiology.entities';
import { EmergencyEncounter } from '../emergency/emergency.entities';

export type WorklistModule =
  | 'registration'
  | 'opd'
  | 'emergency'
  | 'ipd'
  | 'laboratory'
  | 'radiology';

@Injectable()
export class WorklistsService {
  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(PatientIdentifier)
    private readonly identifiers: Repository<PatientIdentifier>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission) private readonly admissions: Repository<Admission>,
    @InjectRepository(LabRequest) private readonly labRequests: Repository<LabRequest>,
    @InjectRepository(RadiologyRequest)
    private readonly radiologyRequests: Repository<RadiologyRequest>,
    @InjectRepository(EmergencyEncounter)
    private readonly emergencyEncounters: Repository<EmergencyEncounter>,
  ) {}

  async list(module: WorklistModule, listKey: string, query: PaginationQueryDto) {
    const { page, pageSize } = normalizePagination(query.page, query.pageSize);

    switch (module) {
      case 'registration':
        return this.registrationList(listKey, query, page, pageSize);
      case 'opd':
        return this.opdList(listKey, query, page, pageSize);
      case 'emergency':
        return this.emergencyList(listKey, query, page, pageSize);
      case 'ipd':
        return this.ipdList(listKey, query, page, pageSize);
      case 'laboratory':
        return this.laboratoryList(listKey, query, page, pageSize);
      case 'radiology':
        return this.radiologyList(listKey, query, page, pageSize);
      default:
        return paginatedResult([], 0, page, pageSize);
    }
  }

  availableLists() {
    return {
      registration: [
        'recently-registered',
        'today',
        'inactive',
        'missing-information',
        'duplicate-candidates',
      ],
      opd: ['waiting', 'triaged', 'with-doctor', 'investigations-pending', 'completed'],
      emergency: ['waiting', 'red', 'orange', 'yellow', 'green', 'observation', 'discharged'],
      ipd: ['current-admissions', 'expected-discharges', 'critical'],
      laboratory: ['requested', 'collected', 'processing', 'completed', 'verified', 'critical'],
      radiology: ['requested', 'scheduled', 'in-progress', 'reported', 'reviewed'],
    };
  }

  private async registrationList(
    listKey: string,
    query: PaginationQueryDto,
    page: number,
    pageSize: number,
  ) {
    const qb = this.patients
      .createQueryBuilder('patient')
      .leftJoinAndSelect('patient.identifiers', 'identifier')
      .where('patient.deleted_at IS NULL');

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    if (listKey === 'recently-registered') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      qb.andWhere('patient.created_at >= :weekAgo', { weekAgo });
    } else if (listKey === 'today') {
      qb.andWhere('patient.created_at >= :startOfDay', { startOfDay });
    } else if (listKey === 'inactive') {
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM encounters e
          WHERE e.patient_id = patient.id AND e.started_at >= :yearAgo
        )`,
        { yearAgo },
      );
    } else if (listKey === 'missing-information') {
      qb.andWhere(
        `(patient.primary_phone IS NULL OR patient.primary_phone = ''
          OR NOT EXISTS (
            SELECT 1 FROM patient_identifiers pi
            WHERE pi.patient_id = patient.id AND pi.type = 'national_id' AND pi.deleted_at IS NULL
          ))`,
      );
    } else if (listKey === 'duplicate-candidates') {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM patients p2
          WHERE p2.id <> patient.id
            AND p2.deleted_at IS NULL
            AND p2.date_of_birth = patient.date_of_birth
            AND (
              p2.primary_phone = patient.primary_phone
              OR lower(p2.last_name) = lower(patient.last_name)
            )
        )`,
      );
    } else {
      return paginatedResult([], 0, page, pageSize);
    }

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        `(patient.first_name ILIKE :term OR patient.last_name ILIKE :term OR patient.patient_no ILIKE :term)`,
        { term },
      );
    }

    qb.orderBy('patient.created_at', query.sortDir === 'asc' ? 'ASC' : 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return paginatedResult(items, total, page, pageSize);
  }

  private async opdList(
    listKey: string,
    query: PaginationQueryDto,
    page: number,
    pageSize: number,
  ) {
    const statusMap: Record<string, Encounter['status']> = {
      waiting: 'registered',
      triaged: 'triaged',
      'with-doctor': 'in_consultation',
      'investigations-pending': 'awaiting_results',
      completed: 'completed',
    };
    const status = statusMap[listKey];
    if (!status) return paginatedResult([], 0, page, pageSize);

    const qb = this.encounters
      .createQueryBuilder('encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .where('encounter.deleted_at IS NULL')
      .andWhere('encounter.type = :type', { type: 'opd' })
      .andWhere('encounter.status = :status', { status });

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        `(patient.first_name ILIKE :term OR patient.last_name ILIKE :term OR patient.patient_no ILIKE :term)`,
        { term },
      );
    }

    qb.orderBy('encounter.started_at', query.sortDir === 'asc' ? 'ASC' : 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return paginatedResult(items, total, page, pageSize);
  }

  private async emergencyList(
    listKey: string,
    query: PaginationQueryDto,
    page: number,
    pageSize: number,
  ) {
    const qb = this.emergencyEncounters
      .createQueryBuilder('ed')
      .leftJoinAndSelect('ed.patient', 'patient')
      .where('ed.deleted_at IS NULL');

    if (listKey === 'waiting') {
      qb.andWhere(`ed.workflow_stage = 'arrival'`);
    } else if (['red', 'orange', 'yellow', 'green'].includes(listKey)) {
      qb.andWhere('ed.triage_category = :cat', { cat: listKey });
    } else if (listKey === 'observation') {
      qb.andWhere(`ed.workflow_stage = 'observation'`);
    } else if (listKey === 'discharged') {
      qb.andWhere(`ed.workflow_stage = 'disposed'`);
    } else {
      return paginatedResult([], 0, page, pageSize);
    }

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        `(patient.first_name ILIKE :term OR patient.last_name ILIKE :term OR patient.patient_no ILIKE :term)`,
        { term },
      );
    }

    qb.orderBy('ed.arrivalTime', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return paginatedResult(items, total, page, pageSize);
  }

  private async ipdList(
    listKey: string,
    query: PaginationQueryDto,
    page: number,
    pageSize: number,
  ) {
    const qb = this.admissions
      .createQueryBuilder('admission')
      .leftJoinAndSelect('admission.patient', 'patient')
      .leftJoinAndSelect('admission.ward', 'ward')
      .where('admission.deleted_at IS NULL');

    if (listKey === 'current-admissions') {
      qb.andWhere(`admission.status = 'active'`);
    } else if (listKey === 'expected-discharges') {
      qb.andWhere(`admission.status = 'active'`);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      qb.andWhere('admission.admitted_at <= :threeDaysAgo', { threeDaysAgo });
    } else if (listKey === 'critical') {
      qb.andWhere(`admission.status = 'active'`);
      qb.andWhere(`ward.type IN ('icu', 'hdu')`);
    } else {
      return paginatedResult([], 0, page, pageSize);
    }

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        `(patient.first_name ILIKE :term OR patient.last_name ILIKE :term OR patient.patient_no ILIKE :term)`,
        { term },
      );
    }

    qb.orderBy('admission.admitted_at', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return paginatedResult(items, total, page, pageSize);
  }

  private async laboratoryList(
    listKey: string,
    query: PaginationQueryDto,
    page: number,
    pageSize: number,
  ) {
    const statusMap: Record<string, LabRequest['status']> = {
      requested: 'requested',
      collected: 'sample_collected',
      processing: 'processing',
      completed: 'resulted',
      verified: 'verified',
    };

    if (listKey === 'critical') {
      return paginatedResult([], 0, page, pageSize);
    }

    const status = statusMap[listKey];
    if (!status) return paginatedResult([], 0, page, pageSize);

    const qb = this.labRequests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.patient', 'patient')
      .where('request.deleted_at IS NULL')
      .andWhere('request.status = :status', { status });

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        `(patient.first_name ILIKE :term OR patient.last_name ILIKE :term OR patient.patient_no ILIKE :term OR request.request_no ILIKE :term)`,
        { term },
      );
    }

    qb.orderBy('request.created_at', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return paginatedResult(items, total, page, pageSize);
  }

  private async radiologyList(
    listKey: string,
    query: PaginationQueryDto,
    page: number,
    pageSize: number,
  ) {
    const statusMap: Record<string, RadiologyRequest['status']> = {
      requested: 'requested',
      scheduled: 'scheduled',
      'in-progress': 'in_progress',
      reported: 'reported',
      reviewed: 'verified',
    };
    const status = statusMap[listKey];
    if (!status) return paginatedResult([], 0, page, pageSize);

    const qb = this.radiologyRequests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.patient', 'patient')
      .where('request.deleted_at IS NULL')
      .andWhere('request.status = :status', { status });

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        `(patient.first_name ILIKE :term OR patient.last_name ILIKE :term OR patient.patient_no ILIKE :term)`,
        { term },
      );
    }

    qb.orderBy('request.created_at', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return paginatedResult(items, total, page, pageSize);
  }
}
