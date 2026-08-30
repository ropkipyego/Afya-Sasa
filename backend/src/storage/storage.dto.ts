import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MAX_UPLOAD_BYTES } from './storage.constants';

export class PresignUploadDto {
  @ApiProperty()
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  contentType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ description: 'Bytes — validated against server max upload size' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  fileSize?: number;

  @ApiPropertyOptional({ description: 'Original filename for extension validation' })
  @IsOptional()
  @IsString()
  filename?: string;
}

export class PresignDownloadDto {
  @ApiProperty()
  @IsString()
  key!: string;
}
