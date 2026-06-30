import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateModalityDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  code!: string;
}

export class CreateRadiologyRequestDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  admissionId?: string;

  @ApiProperty()
  @IsString()
  modalityId!: string;

  @ApiProperty()
  @IsString()
  bodyPart!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  views?: string;

  @ApiProperty()
  @IsString()
  clinicalIndication!: string;

  @ApiProperty({ enum: ['routine', 'urgent', 'stat'] })
  @IsIn(['routine', 'urgent', 'stat'])
  priority!: 'routine' | 'urgent' | 'stat';
}

export class UpdateRadiologyStatusDto {
  @ApiProperty({ enum: ['requested', 'scheduled', 'in_progress', 'reported', 'verified', 'cancelled'] })
  @IsIn(['requested', 'scheduled', 'in_progress', 'reported', 'verified', 'cancelled'])
  status!: 'requested' | 'scheduled' | 'in_progress' | 'reported' | 'verified' | 'cancelled';
}

export class CreateRadiologyReportDto {
  @ApiProperty()
  @IsString()
  findings!: string;

  @ApiProperty()
  @IsString()
  impression!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recommendation?: string;
}

export class CreateRadiologyAttachmentDto {
  @ApiProperty()
  @IsString()
  filename!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @IsString()
  storagePath!: string;
}
