import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateVitalSignsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  admissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pulse?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  respiratoryRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bpSystolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bpDiastolic?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  spo2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bloodGlucose?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gcs?: number;
}

export class CreateMarDto {
  @ApiProperty()
  @IsString()
  admissionId!: string;

  @ApiProperty()
  @IsString()
  medicationName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genericName?: string;

  @ApiProperty()
  @IsString()
  dosage!: string;

  @ApiProperty({ enum: ['oral', 'iv', 'im', 'sc', 'sl', 'topical', 'inhaled', 'rectal', 'nasal'] })
  @IsIn(['oral', 'iv', 'im', 'sc', 'sl', 'topical', 'inhaled', 'rectal', 'nasal'])
  route!: 'oral' | 'iv' | 'im' | 'sc' | 'sl' | 'topical' | 'inhaled' | 'rectal' | 'nasal';

  @ApiProperty()
  @IsString()
  frequency!: string;

  @ApiProperty()
  @IsDateString()
  scheduledTime!: string;
}

export class UpdateMarStatusDto {
  @ApiProperty({ enum: ['given', 'withheld', 'refused', 'not_available'] })
  @IsIn(['given', 'withheld', 'refused', 'not_available'])
  status!: 'given' | 'withheld' | 'refused' | 'not_available';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  withholdReason?: string;
}

export class CreateShiftNoteDto {
  @ApiProperty()
  @IsString()
  wardId!: string;

  @ApiProperty({ enum: ['morning', 'afternoon', 'night'] })
  @IsIn(['morning', 'afternoon', 'night'])
  shift!: 'morning' | 'afternoon' | 'night';

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: ['handover', 'incident', 'general'] })
  @IsIn(['handover', 'incident', 'general'])
  type!: 'handover' | 'incident' | 'general';

  @ApiProperty()
  @IsString()
  body!: string;
}

export class CreateObservationDto {
  @ApiProperty()
  @IsString()
  admissionId!: string;

  @ApiProperty({ enum: ['fluid_intake', 'fluid_output', 'wound', 'bowel', 'urine_output', 'pain', 'neuro', 'skin'] })
  @IsIn(['fluid_intake', 'fluid_output', 'wound', 'bowel', 'urine_output', 'pain', 'neuro', 'skin'])
  type!: 'fluid_intake' | 'fluid_output' | 'wound' | 'bowel' | 'urine_output' | 'pain' | 'neuro' | 'skin';

  @ApiProperty()
  @IsString()
  value!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;
}
