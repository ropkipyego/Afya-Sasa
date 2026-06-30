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

export class EmergencyTriageDto {
  @ApiProperty({ enum: ['red', 'orange', 'yellow', 'green', 'black'] })
  @IsIn(['red', 'orange', 'yellow', 'green', 'black'])
  triageCategory!: 'red' | 'orange' | 'yellow' | 'green' | 'black';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignEmergencyBayDto {
  @ApiProperty()
  @IsString()
  bayId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicianId?: string;
}

export class UpdateEmergencyWorkflowDto {
  @ApiProperty({
    enum: [
      'arrival',
      'triaged',
      'treatment',
      'doctor_assessment',
      'investigations',
      'observation',
      'disposition_pending',
    ],
  })
  @IsIn([
    'arrival',
    'triaged',
    'treatment',
    'doctor_assessment',
    'investigations',
    'observation',
    'disposition_pending',
  ])
  workflowStage!:
    | 'arrival'
    | 'triaged'
    | 'treatment'
    | 'doctor_assessment'
    | 'investigations'
    | 'observation'
    | 'disposition_pending';
}

export class DispositionDto {
  @ApiProperty({
    enum: [
      'discharged_home',
      'admitted_ipd',
      'transferred_icu',
      'transferred_hdu',
      'transferred_theatre',
      'transferred_maternity',
      'external_referral',
      'deceased',
      'left_without_being_seen',
    ],
  })
  @IsIn([
    'discharged_home',
    'admitted_ipd',
    'transferred_icu',
    'transferred_hdu',
    'transferred_theatre',
    'transferred_maternity',
    'external_referral',
    'deceased',
    'left_without_being_seen',
  ])
  outcome!:
    | 'discharged_home'
    | 'admitted_ipd'
    | 'transferred_icu'
    | 'transferred_hdu'
    | 'transferred_theatre'
    | 'transferred_maternity'
    | 'external_referral'
    | 'deceased'
    | 'left_without_being_seen';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transferFacility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateEmergencyNoteDto {
  @ApiProperty({ enum: ['clinical', 'nursing', 'doctor', 'handover'] })
  @IsIn(['clinical', 'nursing', 'doctor', 'handover'])
  noteType!: 'clinical' | 'nursing' | 'doctor' | 'handover';

  @ApiProperty()
  @IsString()
  body!: string;
}

export class CreateObservationLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vitalsSummary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nursingNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doctorReview?: string;
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
