import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateWardDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty({ enum: ['general', 'icu', 'hdu', 'maternity', 'paediatric', 'surgical', 'medical', 'isolation'] })
  @IsIn(['general', 'icu', 'hdu', 'maternity', 'paediatric', 'surgical', 'medical', 'isolation'])
  type!: 'general' | 'icu' | 'hdu' | 'maternity' | 'paediatric' | 'surgical' | 'medical' | 'isolation';

  @ApiPropertyOptional()
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
  @IsString()
  wardId!: string;

  @ApiProperty()
  @IsString()
  bedNo!: string;

  @ApiProperty({ enum: ['standard', 'icu', 'isolation', 'paediatric', 'maternity', 'cardiac'] })
  @IsIn(['standard', 'icu', 'isolation', 'paediatric', 'maternity', 'cardiac'])
  type!: 'standard' | 'icu' | 'isolation' | 'paediatric' | 'maternity' | 'cardiac';
}

export class UpdateBedStatusDto {
  @ApiProperty({ enum: ['available', 'occupied', 'maintenance', 'cleaning'] })
  @IsIn(['available', 'occupied', 'maintenance', 'cleaning'])
  status!: 'available' | 'occupied' | 'maintenance' | 'cleaning';
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
