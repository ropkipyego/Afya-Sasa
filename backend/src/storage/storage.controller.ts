import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { PresignDownloadDto, PresignUploadDto } from './storage.dto';
import { StorageService } from './storage.service';

@ApiBearerAuth()
@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presign-upload')
  @RequirePermissions('files:upload')
  presignUpload(@Body() dto: PresignUploadDto) {
    return this.storageService.presignUpload(dto);
  }

  @Post('presign-download')
  @RequirePermissions('files:download')
  presignDownload(@Body() dto: PresignDownloadDto) {
    return this.storageService.presignDownload(dto.key);
  }
}
