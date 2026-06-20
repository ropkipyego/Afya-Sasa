import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateIcuAdmissionDto {
  @ApiProperty()
  @IsString()
  admissionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icuBedId?: string;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  severityScore?: number;
}

export class CreateIcuObservationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  heartRate?: number;

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
  @IsInt()
  gcs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateVentilatorRecordDto {
  @ApiProperty()
  @IsString()
  mode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  fio2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  peep?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tidalVolume?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateFluidBalanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  inputVolumeMl?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  outputVolumeMl?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateIcuRoundDto {
  @ApiProperty()
  @IsString()
  assessment!: string;

  @ApiProperty()
  @IsString()
  plan!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  escalationDecision?: string;
}

export class UpdateIcuStatusDto {
  @ApiProperty({ enum: ['transferred_out', 'discharged', 'died'] })
  @IsIn(['transferred_out', 'discharged', 'died'])
  status!: 'transferred_out' | 'discharged' | 'died';
}
