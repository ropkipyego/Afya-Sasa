import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UploadClinicalFileDto {
  @ApiProperty({ description: 'Logical folder, e.g. documents, laboratory, encounters' })
  @IsString()
  folder!: string;

  @ApiProperty({ description: 'Patient id, encounter id, or request id for namespacing' })
  @IsString()
  requestId!: string;
}
