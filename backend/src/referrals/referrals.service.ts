import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { User } from '../core/core.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';
import { CreateReferralDto, UpdateReferralStatusDto } from './referral.dto';
import { Referral } from './referral.entities';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral) private readonly referrals: Repository<Referral>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Encounter) private readonly encounters: Repository<Encounter>,
  ) {}

  async create(dto: CreateReferralDto, request: RequestContext) {
    const [patient, encounter] = await Promise.all([
      this.patients.findOne({ where: { id: dto.patientId } }),
      dto.encounterId ? this.encounters.findOne({ where: { id: dto.encounterId } }) : null,
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    return this.referrals.save(
      this.referrals.create({
        patient,
        encounter,
        referringDoctor: request.user?.sub ? ({ id: request.user.sub } as User) : null,
        receivingUser: dto.receivingUserId ? ({ id: dto.receivingUserId } as User) : null,
        type: dto.type,
        targetDepartment: dto.targetDepartment ?? null,
        targetFacility: dto.targetFacility ?? null,
        reason: dto.reason,
        letter: dto.letter,
        status: 'sent',
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  list(patientId?: string, status?: string) {
    return this.referrals.find({
      where: {
        patient: patientId ? { id: patientId } : undefined,
        status: status as never,
      },
      relations: { patient: true, encounter: true, receivingUser: true },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, dto: UpdateReferralStatusDto, request: RequestContext) {
    await this.referrals.update(id, {
      status: dto.status,
      updatedBy: request.user?.sub ?? null,
    });
    return this.referrals.findOneOrFail({ where: { id } });
  }
}
