import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../core/auth/auth.decorators';
import type { RequestContext } from '../common/request-context';
import { PresignDownloadDto, PresignUploadDto } from './storage.dto';
import { UploadClinicalFileDto } from './storage-upload.dto';
import { MAX_UPLOAD_BYTES } from './storage.constants';
import { StorageService } from './storage.service';

@ApiBearerAuth()
@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @RequirePermissions('files:upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'folder', 'requestId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string' },
        requestId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  upload(
    @UploadedFile()
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    @Body() dto: UploadClinicalFileDto,
    @Req() request: RequestContext,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required.');
    }
    return this.storageService.uploadObject({
      buffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype || 'application/octet-stream',
      folder: dto.folder,
      requestId: dto.requestId,
      tenantCode: request.tenant?.code,
    });
  }

  @Post('presign-upload')
  @RequirePermissions('files:upload')
  presignUpload(@Body() dto: PresignUploadDto, @Req() request: RequestContext) {
    return this.storageService.presignUpload({
      ...dto,
      tenantCode: request.tenant?.code,
    });
  }

  @Post('presign-download')
  @RequirePermissions('files:download')
  presignDownload(@Body() dto: PresignDownloadDto, @Req() request: RequestContext) {
    return this.storageService.presignDownload(dto.key, request.tenant?.code);
  }

  @Post('fetch')
  @RequirePermissions('files:download')
  async fetchObject(
    @Body() dto: PresignDownloadDto,
    @Req() request: RequestContext,
    @Res() response: Response,
  ) {
    try {
      const file = await this.storageService.getObject(dto.key, request.tenant?.code);
      const safeName = file.filename.replace(/"/g, '');
      const inline = file.contentType === 'application/pdf' || file.contentType.startsWith('image/');
      response.setHeader('Content-Type', file.contentType);
      response.setHeader(
        'Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
      );
      response.setHeader('Cache-Control', 'private, no-store');
      response.send(file.buffer);
    } catch {
      throw new NotFoundException('Document was not found.');
    }
  }
}
