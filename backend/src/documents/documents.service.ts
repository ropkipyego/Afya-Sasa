import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { Patient } from '../patients/patient.entities';
import { ClinicalDocument } from './clinical-document.entity';
import { RegisterClinicalDocumentDto } from './documents.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(ClinicalDocument)
    private readonly documents: Repository<ClinicalDocument>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
  ) {}

  async register(dto: RegisterClinicalDocumentDto, request: RequestContext) {
    const patient = await this.patients.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    return this.documents.save(
      this.documents.create({
        patient,
        documentType: dto.documentType,
        title: dto.title,
        description: dto.description ?? null,
        filename: dto.filename,
        mimeType: dto.mimeType,
        storagePath: dto.storagePath,
        fileSize: dto.fileSize ?? 0,
        checksum: dto.checksum ?? null,
        encounterId: dto.encounterId ?? null,
        admissionId: dto.admissionId ?? null,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  listForPatient(patientId: string, documentType?: string) {
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }
    const where: { patient: { id: string }; documentType?: ClinicalDocument['documentType'] } = {
      patient: { id: patientId },
    };
    if (documentType) {
      where.documentType = documentType as ClinicalDocument['documentType'];
    }
    return this.documents.find({
      where,
      relations: { patient: true },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async getOne(id: string) {
    const doc = await this.documents.findOne({
      where: { id },
      relations: { patient: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }
}
