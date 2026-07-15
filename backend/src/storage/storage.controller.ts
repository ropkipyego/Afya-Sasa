import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../core/auth/auth.decorators';
import type { RequestContext } from '../common/request-context';
import { PresignDownloadDto, PresignUploadDto } from './storage.dto';
import { StorageService } from './storage.service';

@ApiBearerAuth()
@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

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
}
