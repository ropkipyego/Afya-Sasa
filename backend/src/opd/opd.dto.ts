import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateEncounterDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiProperty()
  @IsString()
  presentingComplaint!: string;

  @ApiPropertyOptional({ enum: ['new', 'follow_up', 'referral'] })
  @IsOptional()
  @IsIn(['new', 'follow_up', 'referral'])
  visitType?: 'new' | 'follow_up' | 'referral';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralReason?: string;
}

export class UpdateEncounterStatusDto {
  @ApiProperty({
    enum: [
      'registered',
      'triaged',
      'in_consultation',
      'awaiting_results',
      'admitted',
      'completed',
    ],
  })
  @IsIn([
    'registered',
    'triaged',
    'in_consultation',
    'awaiting_results',
    'admitted',
    'completed',
  ])
  status!:
    | 'registered'
    | 'triaged'
    | 'in_consultation'
    | 'awaiting_results'
    | 'admitted'
    | 'completed';
}

export class CreateTriageDto {
  @ApiProperty()
  @IsString()
  category!: string;

  @ApiProperty({ enum: ['red', 'orange', 'yellow', 'green', 'blue'] })
  @IsIn(['red', 'orange', 'yellow', 'green', 'blue'])
  colour!: 'red' | 'orange' | 'yellow' | 'green' | 'blue';

  @ApiProperty()
  @IsString()
  chiefComplaint!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  pulse?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  respiratoryRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bpSystolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bpDiastolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  spo2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRetriage?: boolean;
}

export class CreateConsultationDto {
  @ApiProperty()
  @IsString()
  subjective!: string;

  @ApiProperty()
  @IsString()
  objective!: string;

  @ApiProperty()
  @IsString()
  assessment!: string;

  @ApiProperty()
  @IsString()
  plan!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  followUpInstructions?: string;
}

export class UpdateConsultationDto extends PartialType(CreateConsultationDto) {}

export class CreateDiagnosisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icd10Code?: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ enum: ['primary', 'secondary', 'differential'] })
  @IsIn(['primary', 'secondary', 'differential'])
  type!: 'primary' | 'secondary' | 'differential';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}

export class CreateClinicalNoteDto {
  @ApiProperty({
    enum: ['doctor', 'nursing', 'progress', 'procedure', 'handover', 'referral', 'discharge'],
  })
  @IsIn(['doctor', 'nursing', 'progress', 'procedure', 'handover', 'referral', 'discharge'])
  type!: 'doctor' | 'nursing' | 'progress' | 'procedure' | 'handover' | 'referral' | 'discharge';

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  amendsNoteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  amendmentReason?: string;
}

export class CreateAttachmentDto {
  @ApiProperty()
  @IsString()
  filename!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  fileSize!: number;

  @ApiProperty()
  @IsString()
  storagePath!: string;
}
