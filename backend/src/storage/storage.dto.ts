import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

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
}

export class PresignDownloadDto {
  @ApiProperty()
  @IsString()
  key!: string;
}
