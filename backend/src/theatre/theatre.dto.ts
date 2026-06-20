import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateTheatreDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;
}

export class UpdateTheatreDto extends PartialType(CreateTheatreDto) {
  @ApiPropertyOptional({ enum: ['available', 'in_use', 'maintenance', 'closed'] })
  @IsOptional()
  @IsIn(['available', 'in_use', 'maintenance', 'closed'])
  status?: 'available' | 'in_use' | 'maintenance' | 'closed';
}

export class CreateSurgicalProcedureDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedDurationMinutes?: number;
}

export class CreateSurgeryBookingDto {
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
  procedureId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  theatreId?: string;

  @ApiProperty()
  @IsDateString()
  scheduledStartAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledEndAt?: string;

  @ApiProperty({ enum: ['elective', 'urgent', 'emergency'] })
  @IsIn(['elective', 'urgent', 'emergency'])
  priority!: 'elective' | 'urgent' | 'emergency';
}

export class UpdateSurgeryBookingStatusDto {
  @ApiProperty({
    enum: ['requested', 'scheduled', 'pre_op', 'in_theatre', 'recovery', 'completed', 'cancelled'],
  })
  @IsIn(['requested', 'scheduled', 'pre_op', 'in_theatre', 'recovery', 'completed', 'cancelled'])
  status!: 'requested' | 'scheduled' | 'pre_op' | 'in_theatre' | 'recovery' | 'completed' | 'cancelled';
}

export class AssignSurgeryStaffDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({
    enum: ['primary_surgeon', 'assistant_surgeon', 'anesthetist', 'theatre_nurse', 'scrub_nurse', 'circulating_nurse'],
  })
  @IsIn(['primary_surgeon', 'assistant_surgeon', 'anesthetist', 'theatre_nurse', 'scrub_nurse', 'circulating_nurse'])
  role!: 'primary_surgeon' | 'assistant_surgeon' | 'anesthetist' | 'theatre_nurse' | 'scrub_nurse' | 'circulating_nurse';
}

export class CreateSurgeryNoteDto {
  @ApiProperty({
    enum: ['pre_op_assessment', 'consent', 'checklist', 'intraoperative', 'operation', 'findings', 'post_op', 'recovery'],
  })
  @IsIn(['pre_op_assessment', 'consent', 'checklist', 'intraoperative', 'operation', 'findings', 'post_op', 'recovery'])
  type!: 'pre_op_assessment' | 'consent' | 'checklist' | 'intraoperative' | 'operation' | 'findings' | 'post_op' | 'recovery';

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

export class CreateSurgeryComplicationDto {
  @ApiProperty({ enum: ['minor', 'moderate', 'severe', 'sentinel'] })
  @IsIn(['minor', 'moderate', 'severe', 'sentinel'])
  severity!: 'minor' | 'moderate' | 'severe' | 'sentinel';

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsString()
  actionTaken!: string;
}
