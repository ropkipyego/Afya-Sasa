import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Admission } from '../inpatient/inpatient.entities';
import { Encounter } from '../opd/opd.entities';
import { Patient } from '../patients/patient.entities';

@Injectable()
export class ClinicalOrderContextService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounters: Repository<Encounter>,
    @InjectRepository(Admission)
    private readonly admissions: Repository<Admission>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
  ) {}

  async resolveEncounter(
    params: {
      patientId: string;
      encounterId?: string;
      admissionId?: string;
    },
    request: RequestContext,
  ): Promise<{ encounter: Encounter; admission: Admission | null }> {
    const patient = await this.patients.findOne({ where: { id: params.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    if (!params.encounterId && !params.admissionId) {
      const activeAdmission = await this.admissions.findOne({
        where: { patient: { id: params.patientId }, status: 'active' },
        relations: { encounter: { attendingDoctor: true }, ward: true, admittingDoctor: true },
        order: { admittedAt: 'DESC' },
      });
      if (activeAdmission) {
        return this.resolveEncounter(
          { patientId: params.patientId, admissionId: activeAdmission.id },
          request,
        );
      }

      const openEncounter = await this.encounters.findOne({
        where: {
          patient: { id: params.patientId },
          status: Not('completed'),
        },
        relations: { attendingDoctor: true },
        order: { startedAt: 'DESC' },
      });
      if (openEncounter) {
        return { encounter: openEncounter, admission: null };
      }

      throw new BadRequestException(
        'No active visit found. Check the patient in to OPD or admit them before ordering investigations.',
      );
    }

    if (params.encounterId) {
      const encounter = await this.encounters.findOne({
        where: { id: params.encounterId, patient: { id: params.patientId } },
        relations: { attendingDoctor: true },
      });
      if (!encounter) throw new NotFoundException('Encounter not found for this patient');
      const admission = params.admissionId
        ? await this.admissions.findOne({
            where: { id: params.admissionId, patient: { id: params.patientId } },
          })
        : null;
      return { encounter, admission };
    }

    const admission = await this.admissions.findOne({
      where: { id: params.admissionId, patient: { id: params.patientId } },
      relations: { encounter: { attendingDoctor: true }, ward: true, admittingDoctor: true },
    });
    if (!admission) throw new NotFoundException('Admission not found for this patient');

    if (admission.encounter) {
      return { encounter: admission.encounter, admission };
    }

    const encounter = await this.encounters.save(
      this.encounters.create({
        encounterNo: await this.generateInpatientEncounterNo(),
        patient,
        type: 'inpatient',
        status: 'admitted',
        attendingDoctor: admission.admittingDoctor ?? null,
        presentingComplaint: admission.reason,
        visitType: null,
        referralSource: null,
        referralReason: null,
        destination: null,
        departmentName: admission.ward?.name ?? null,
        paymentMethod: null,
        receiptNumber: null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );

    await this.admissions.update(admission.id, {
      encounter: { id: encounter.id } as never,
      updatedBy: request.user?.sub ?? null,
    });

    return { encounter, admission };
  }

  private async generateInpatientEncounterNo() {
    const year = new Date().getFullYear();
    const total = await this.encounters.count({ where: { type: 'inpatient' } });
    return `IPD-${year}-${String(total + 1).padStart(5, '0')}`;
  }
}
