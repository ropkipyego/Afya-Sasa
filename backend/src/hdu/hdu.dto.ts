import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateHduAdmissionDto {
  @ApiProperty()
  @IsString()
  admissionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hduBedId?: string;

  @ApiProperty()
  @IsString()
  reason!: string;
}

export class CreateHduObservationDto {
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
  @IsString()
  oxygenSupport?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  escalationRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateHduRoundDto {
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

export class UpdateHduStatusDto {
  @ApiProperty({ enum: ['transferred_out', 'discharged', 'died'] })
  @IsIn(['transferred_out', 'discharged', 'died'])
  status!: 'transferred_out' | 'discharged' | 'died';
}
