import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { BED_STATUSES, BED_TYPES, WARD_TYPES } from './inpatient.constants';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class CreateWardDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Ward name is required' })
  name!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Ward code is required' })
  code!: string;

  @ApiProperty({ enum: WARD_TYPES })
  @IsIn([...WARD_TYPES])
  type!: (typeof WARD_TYPES)[number];

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  floor?: string;
}

export class UpdateWardDto extends PartialType(CreateWardDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateBedDto {
  @ApiProperty()
  @Transform(trimString)
  @IsUUID('all', { message: 'A valid ward is required' })
  @IsNotEmpty({ message: 'Ward is required' })
  wardId!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Bed number is required' })
  bedNo!: string;

  @ApiProperty({ enum: BED_TYPES })
  @IsIn([...BED_TYPES])
  type!: (typeof BED_TYPES)[number];
}

export class UpdateBedStatusDto {
  @ApiProperty({ enum: BED_STATUSES })
  @IsIn([...BED_STATUSES])
  status!: (typeof BED_STATUSES)[number];
}

export class CreateAdmissionDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiProperty()
  @IsString()
  bedId!: string;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiProperty({ enum: ['elective', 'emergency', 'transfer'] })
  @IsIn(['elective', 'emergency', 'transfer'])
  type!: 'elective' | 'emergency' | 'transfer';
}

export class TransferBedDto {
  @ApiProperty()
  @IsString()
  toBedId!: string;

  @ApiProperty()
  @IsString()
  reason!: string;
}

export class CreateProgressNoteDto {
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
}

export class CreateDischargeSummaryDto {
  @ApiProperty()
  @IsString()
  presentingComplaint!: string;

  @ApiProperty()
  @IsString()
  history!: string;

  @ApiProperty()
  @IsString()
  examOnAdmission!: string;

  @ApiProperty()
  @IsString()
  investigationsSummary!: string;

  @ApiProperty()
  @IsString()
  finalDiagnosis!: string;

  @ApiProperty()
  @IsString()
  treatmentGiven!: string;

  @ApiProperty()
  @IsString()
  dischargeMeds!: string;

  @ApiProperty()
  @IsString()
  followUpInstructions!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diet?: string;
}

export class DischargeAdmissionDto {
  @ApiProperty({ enum: ['improved', 'same', 'deteriorated', 'died', 'absconded'] })
  @IsIn(['improved', 'same', 'deteriorated', 'died', 'absconded'])
  conditionOnDischarge!: 'improved' | 'same' | 'deteriorated' | 'died' | 'absconded';
}
