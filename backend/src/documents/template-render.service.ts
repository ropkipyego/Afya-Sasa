import { Injectable, NotFoundException } from '@nestjs/common';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class TemplateRenderService {
  constructor(private readonly storage: StorageService) {}

  async renderDocx(storagePath: string, variables: Record<string, unknown>): Promise<Buffer> {
    const templateBuffer = await this.storage.getObjectBuffer(storagePath);
    try {
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
      doc.render(variables as Record<string, string | number | unknown[]>);
      return Buffer.from(doc.getZip().generate({ type: 'nodebuffer' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Template render failed';
      throw new NotFoundException(`DOCX template render failed: ${message}`);
    }
  }
}
