import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { BloodBankRequest, type BloodBankProduct, type BloodBankStatus } from './blood-bank.entities';
import { BloodBankUnit } from './blood-bank-unit.entities';
import {
  assertBloodBankIssueReady,
  assertBloodBankRequestTransition,
  assertCanIssueBlood,
  BLOOD_BANK_METRIC_DEFINITIONS,
} from './blood-bank-policy';
import {
  assertUnitMayBecomeAvailable,
  assertUnitTransition,
  summariseBloodUnits,
  type BloodUnitScreening,
  type BloodUnitStatus,
} from './blood-bank-stock';

const PRODUCTS: BloodBankProduct[] = [
  'packed_red_cells',
  'whole_blood',
  'ffp',
  'platelets',
  'cryoprecipitate',
];

@Injectable()
export class BloodBankService {
  constructor(
    @InjectRepository(BloodBankRequest)
    private readonly requests: Repository<BloodBankRequest>,
    @InjectRepository(BloodBankUnit)
    private readonly units: Repository<BloodBankUnit>,
  ) {}

  async list() {
    if (!(await this.requestsTableReady())) return [];
    return this.requests.find({
      relations: { patient: true, encounter: true, admission: true },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async stock(from?: string, to?: string) {
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(end.getTime() - 29 * 86_400_000);
    const requestWorkload = await this.requestWorkload(start, end);
    if (!(await this.unitsTableReady())) {
      return {
        available: false,
        reason:
          'Blood unit ledger is not on this database. Request workflow is available; physical stock is not. Do not treat request counts as units on the shelf.',
        generatedAt: new Date().toISOString(),
        range: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
        definitions: BLOOD_BANK_METRIC_DEFINITIONS,
        requestWorkload,
      };
    }
    const rows = await this.units.find({ take: 5000 });
    const summary = summariseBloodUnits(
      rows.map((row) => ({
        unitNo: row.unitNo,
        bloodGroup: row.bloodGroup,
        status: row.status,
        screeningStatus: row.screeningStatus,
        expiresAt: row.expiresAt,
        issuedAt: row.issuedAt,
        updatedAt: row.updatedAt,
        reservedRequestId: row.reservedRequestId,
      })),
      { start, end },
    );
    return {
      ...summary,
      range: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
      requestWorkload,
    };
  }

  async create(
    dto: {
      patientId: string
      encounterId?: string
      admissionId?: string
      product: BloodBankProduct
      units: number
      patientBloodGroup?: string
      indication?: string
    },
    request: RequestContext,
  ) {
    if (!(await this.requestsTableReady())) {
      throw new BadRequestException(
        'Blood bank tables are not applied on this database yet. This is a laboratory request, not pharmacy stock.',
      );
    }
    if (!PRODUCTS.includes(dto.product)) {
      throw new BadRequestException('Choose a blood product (packed cells, whole blood, FFP, platelets or cryoprecipitate).');
    }
    if (!Number.isFinite(dto.units) || dto.units <= 0 || dto.units > 20) {
      throw new BadRequestException('Enter a sensible number of units.');
    }
    const id = randomUUID();
    return this.requests.save(
      this.requests.create({
        id,
        requestNo: `BB-${Date.now()}`,
        patient: { id: dto.patientId } as never,
        encounter: dto.encounterId ? ({ id: dto.encounterId } as never) : null,
        admission: dto.admissionId ? ({ id: dto.admissionId } as never) : null,
        product: dto.product,
        units: String(dto.units),
        patientBloodGroup: dto.patientBloodGroup?.trim() || null,
        indication: dto.indication?.trim() || null,
        status: 'requested',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async updateStatus(
    id: string,
    dto: { status: BloodBankStatus; groupingResult?: string | null; crossmatchResult?: string | null },
    request: RequestContext,
  ) {
    return this.requests.manager.transaction(async (manager) => {
      const repo = manager.getRepository(BloodBankRequest);
      const row = await repo.findOne({
        where: { id },
        relations: { patient: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Blood bank request not found');
      if (dto.groupingResult !== undefined) row.groupingResult = dto.groupingResult?.trim() || null;
      if (dto.crossmatchResult !== undefined) row.crossmatchResult = dto.crossmatchResult?.trim() || null;
      assertBloodBankRequestTransition(row.status, dto.status);
      if (dto.status === 'issued') {
        assertCanIssueBlood(request.user?.permissions);
        assertBloodBankIssueReady(row);
        row.issuedAt = new Date();
      }
      row.status = dto.status;
      row.updatedBy = request.user?.sub ?? null;
      return repo.save(row);
    });
  }

  async registerUnit(
    dto: {
      unitNo: string
      product: BloodBankProduct
      bloodGroup: string
      expiresAt: string
      collectedAt?: string
      location?: string
    },
    request: RequestContext,
  ) {
    if (!(await this.unitsTableReady())) {
      throw new BadRequestException(
        'Blood unit ledger is not applied on this database. Registering a unit is blocked until the reviewed migration is authorised.',
      );
    }
    if (!PRODUCTS.includes(dto.product)) {
      throw new BadRequestException('Choose a blood product.');
    }
    const unitNo = dto.unitNo.trim();
    if (!unitNo) throw new BadRequestException('Each unit needs a unique identifier.');
    const existing = await this.units.findOne({ where: { unitNo } });
    if (existing) throw new BadRequestException('That unit identifier is already registered.');
    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new BadRequestException('Expiry date is required.');
    return this.units.save(
      this.units.create({
        id: randomUUID(),
        unitNo,
        product: dto.product,
        bloodGroup: dto.bloodGroup.trim(),
        collectedAt: dto.collectedAt ? new Date(dto.collectedAt) : null,
        receivedAt: new Date(),
        expiresAt,
        screeningStatus: 'awaiting_screening',
        status: 'received',
        location: dto.location?.trim() || null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async transitionUnit(
    id: string,
    dto: {
      status: BloodUnitStatus
      screeningStatus?: BloodUnitScreening
      reservedRequestId?: string | null
      reason?: string
    },
    request: RequestContext,
  ) {
    if (!(await this.unitsTableReady())) {
      throw new BadRequestException('Blood unit ledger is not applied on this database.');
    }
    return this.units.manager.transaction(async (manager) => {
      const repo = manager.getRepository(BloodBankUnit);
      const row = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException('Blood unit not found');
      if (dto.screeningStatus) row.screeningStatus = dto.screeningStatus;
      try {
        assertUnitTransition(row.status, dto.status);
        if (dto.status === 'available') {
          assertUnitMayBecomeAvailable(row.screeningStatus, row.expiresAt, new Date());
        }
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Invalid unit transition');
      }
      if (dto.status === 'issued') {
        assertCanIssueBlood(request.user?.permissions);
        if (row.status === 'issued') {
          throw new BadRequestException('This unit was already issued.');
        }
        row.issuedAt = new Date();
        row.issuedRequestId = dto.reservedRequestId ?? row.reservedRequestId;
      }
      if (dto.status === 'reserved') {
        if (!dto.reservedRequestId) {
          throw new BadRequestException('Reserve a unit against a blood bank request.');
        }
        row.reservedRequestId = dto.reservedRequestId;
      }
      if (dto.status === 'available' && row.status === 'reserved') {
        row.reservedRequestId = null;
      }
      row.status = dto.status;
      row.lastReason = dto.reason?.trim() || row.lastReason;
      row.updatedBy = request.user?.sub ?? null;
      return repo.save(row);
    });
  }

  private async requestWorkload(start: Date, end: Date) {
    if (!(await this.requestsTableReady())) {
      return { openRequests: 0, issuedRequestsInPeriod: 0 };
    }
    const rows = await this.requests.find({ take: 2000 });
    return {
      openRequests: rows.filter((row) => row.status !== 'issued' && row.status !== 'cancelled').length,
      issuedRequestsInPeriod: rows.filter(
        (row) =>
          row.status === 'issued' &&
          row.issuedAt &&
          row.issuedAt >= start &&
          row.issuedAt <= end,
      ).length,
    };
  }

  private requestsTableReadyCache?: boolean;
  private unitsTableReadyCache?: boolean;

  private async requestsTableReady() {
    if (this.requestsTableReadyCache != null) return this.requestsTableReadyCache;
    this.requestsTableReadyCache = await this.tableExists('blood_bank_requests');
    return this.requestsTableReadyCache;
  }

  private async unitsTableReady() {
    if (this.unitsTableReadyCache != null) return this.unitsTableReadyCache;
    this.unitsTableReadyCache = await this.tableExists('blood_bank_units');
    return this.unitsTableReadyCache;
  }

  private async tableExists(tableName: string) {
    const rows = (await this.requests.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'demo'
          AND table_name = $1`,
      [tableName],
    )) as Array<{ table_name: string }>;
    return rows.length === 1;
  }
}
