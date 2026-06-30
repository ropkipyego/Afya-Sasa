import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RegisterPregnancyDto {
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
  @IsInt()
  @Min(0)
  gravida!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  para!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lmpDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  edd?: string;

  @ApiPropertyOptional({ enum: ['low', 'moderate', 'high'] })
  @IsOptional()
  @IsIn(['low', 'moderate', 'high'])
  riskLevel?: 'low' | 'moderate' | 'high';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskNotes?: string;
}

export class CreateAncVisitDto {
  @ApiProperty()
  @IsDateString()
  visitDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  gestationalAgeWeeks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskAssessment?: string;

  @ApiProperty()
  @IsString()
  plan!: string;

  @ApiPropertyOptional()
  @IsOptional()
  weightKg?: number;

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
  fetalHeartRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  fundalHeightCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ultrasoundSummary?: string;
}

export class CreateLabourRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  admissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  cervicalDilationCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  fetalHeartRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  membranesStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDeliveryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  admissionId?: string;

  @ApiProperty()
  @IsDateString()
  deliveryTime!: string;

  @ApiProperty({ enum: ['svd', 'assisted', 'cesarean', 'breech'] })
  @IsIn(['svd', 'assisted', 'cesarean', 'breech'])
  mode!: 'svd' | 'assisted' | 'cesarean' | 'breech';

  @ApiProperty({ enum: ['live_birth', 'stillbirth', 'maternal_transfer', 'maternal_death'] })
  @IsIn(['live_birth', 'stillbirth', 'maternal_transfer', 'maternal_death'])
  outcome!: 'live_birth' | 'stillbirth' | 'maternal_transfer' | 'maternal_death';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bloodLossMl?: number;
}

export class CreateNewbornDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  babyPatientId?: string;

  @ApiProperty({ enum: ['female', 'male', 'unknown'] })
  @IsIn(['female', 'male', 'unknown'])
  sex!: 'female' | 'male' | 'unknown';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  birthWeightGrams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  apgar1Min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  apgar5Min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  apgar10Min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  resuscitationRequired?: boolean;

  @ApiProperty({ enum: ['alive', 'stillborn', 'referred', 'deceased'] })
  @IsIn(['alive', 'stillborn', 'referred', 'deceased'])
  status!: 'alive' | 'stillborn' | 'referred' | 'deceased';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  babyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  birthOrder?: number;

  @ApiPropertyOptional({ enum: ['singleton', 'twin', 'triplet', 'higher_order'] })
  @IsOptional()
  @IsIn(['singleton', 'twin', 'triplet', 'higher_order'])
  multipleBirth?: 'singleton' | 'twin' | 'triplet' | 'higher_order';
}

export class RegisterNewbornPatientDto {
  @ApiProperty({ enum: ['female', 'male', 'unknown'] })
  @IsIn(['female', 'male', 'unknown'])
  sex!: 'female' | 'male' | 'unknown';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  birthWeightGrams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  apgar1Min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  apgar5Min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  babyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  birthOrder?: number;

  @ApiPropertyOptional({ enum: ['singleton', 'twin', 'triplet', 'higher_order'] })
  @IsOptional()
  @IsIn(['singleton', 'twin', 'triplet', 'higher_order'])
  multipleBirth?: 'singleton' | 'twin' | 'triplet' | 'higher_order';

  @ApiPropertyOptional({ enum: ['alive', 'stillborn', 'referred', 'deceased'] })
  @IsOptional()
  @IsIn(['alive', 'stillborn', 'referred', 'deceased'])
  status?: 'alive' | 'stillborn' | 'referred' | 'deceased';
}

export class CreatePartographEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  cervicalDilationCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  contractionsPer10Min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  contractionDurationSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  fetalHeartRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maternalPulse?: number;

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
  temperatureC?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  liquorStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moulding?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RenameNewbornDto {
  @ApiProperty()
  @IsString()
  babyName!: string;
}

export class CreateMaternityUnitAdmissionDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiProperty({ enum: ['anc', 'labour', 'postnatal', 'nursery', 'nicu'] })
  @IsIn(['anc', 'labour', 'postnatal', 'nursery', 'nicu'])
  unit!: 'anc' | 'labour' | 'postnatal' | 'nursery' | 'nicu';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pregnancyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  newbornId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicalSummary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedingStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oxygenSupport?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  incubatorStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  weightGrams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePostnatalVisitDto {
  @ApiProperty()
  @IsDateString()
  visitDate!: string;

  @ApiProperty()
  @IsString()
  motherCondition!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  newbornCondition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedingStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dangerSigns?: string;

  @ApiProperty()
  @IsString()
  plan!: string;
}
