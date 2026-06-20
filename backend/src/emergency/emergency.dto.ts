import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateEmergencyEncounterDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiProperty()
  @IsString()
  presentingComplaint!: string;

  @ApiProperty({ enum: ['ambulance', 'walk_in', 'police', 'referral', 'airlift'] })
  @IsIn(['ambulance', 'walk_in', 'police', 'referral', 'airlift'])
  arrivalMode!: 'ambulance' | 'walk_in' | 'police' | 'referral' | 'airlift';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  traumaFlag?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  traumaMechanism?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  resuscitationFlag?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resuscitationNotes?: string;
}

export class DispositionDto {
  @ApiProperty({ enum: ['admitted', 'discharged', 'transferred', 'died', 'left_without_being_seen'] })
  @IsIn(['admitted', 'discharged', 'transferred', 'died', 'left_without_being_seen'])
  disposition!: 'admitted' | 'discharged' | 'transferred' | 'died' | 'left_without_being_seen';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transferFacility?: string;
}

export class CreateCriticalAlertDto {
  @ApiProperty()
  @IsString()
  encounterId!: string;

  @ApiProperty({ enum: ['critical_vitals', 'allergy', 'critical_lab', 'drug_interaction', 'code_blue'] })
  @IsIn(['critical_vitals', 'allergy', 'critical_lab', 'drug_interaction', 'code_blue'])
  type!: 'critical_vitals' | 'allergy' | 'critical_lab' | 'drug_interaction' | 'code_blue';

  @ApiProperty({ enum: ['warning', 'critical'] })
  @IsIn(['warning', 'critical'])
  severity!: 'warning' | 'critical';

  @ApiProperty()
  @IsString()
  message!: string;
}
