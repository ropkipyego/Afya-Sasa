import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSlotDto {
  @ApiProperty()
  @IsString()
  doctorId!: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsString()
  startTime!: string;

  @ApiProperty()
  @IsString()
  endTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPatients?: number;
}

export class UpdateSlotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}

export class CreateAppointmentDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiProperty()
  @IsString()
  doctorId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slotId?: string;

  @ApiProperty()
  @IsDateString()
  appointmentDate!: string;

  @ApiProperty()
  @IsString()
  appointmentTime!: string;

  @ApiProperty({ enum: ['new', 'follow_up', 'procedure', 'review', 'antenatal'] })
  @IsIn(['new', 'follow_up', 'procedure', 'review', 'antenatal'])
  type!: 'new' | 'follow_up' | 'procedure' | 'review' | 'antenatal';

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceEncounterId?: string;
}

export class UpdateAppointmentStatusDto {
  @ApiProperty({
    enum: ['scheduled', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'],
  })
  @IsIn(['scheduled', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'])
  status!: 'scheduled' | 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show';
}
