import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../common/request-context';
import { PublishHospitalDocumentDto } from './documents.dto';
import { HospitalDocument } from './hospital-document.entity';

@Injectable()
export class HospitalDocumentsService {
  constructor(
    @InjectRepository(HospitalDocument)
    private readonly documents: Repository<HospitalDocument>,
  ) {}

  list(category?: string, audience?: string) {
    const where: { category?: string; audience?: string; isPublished: boolean } = {
      isPublished: true,
    };
    if (category) where.category = category;
    if (audience && audience !== 'all') where.audience = audience;
    return this.documents.find({
      where,
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }

  async publish(dto: PublishHospitalDocumentDto, request: RequestContext) {
    return this.documents.save(
      this.documents.create({
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? 'general',
        filename: dto.filename,
        mimeType: dto.mimeType,
        storagePath: dto.storagePath,
        fileSize: dto.fileSize ?? 0,
        audience: dto.audience ?? 'all',
        isPublished: true,
        createdBy: request.user?.sub ?? null,
        updatedBy: request.user?.sub ?? null,
      }),
    );
  }

  async remove(id: string, _request: RequestContext) {
    const doc = await this.documents.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Hospital document not found');
    await this.documents.softRemove(doc);
    return { id };
  }
}
