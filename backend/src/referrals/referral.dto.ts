import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateReferralDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiProperty({ enum: ['internal', 'external'] })
  @IsIn(['internal', 'external'])
  type!: 'internal' | 'external';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receivingUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetDepartment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetFacility?: string;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiProperty()
  @IsString()
  letter!: string;
}

export class UpdateReferralStatusDto {
  @ApiProperty({ enum: ['draft', 'sent', 'accepted', 'completed', 'cancelled'] })
  @IsIn(['draft', 'sent', 'accepted', 'completed', 'cancelled'])
  status!: 'draft' | 'sent' | 'accepted' | 'completed' | 'cancelled';
}
