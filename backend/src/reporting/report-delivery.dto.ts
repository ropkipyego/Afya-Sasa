import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export const INTERNAL_REPORT_TYPES = [
  'dashboard',
  'operations',
  'intelligence',
  'executive-analytics',
] as const;

export class DeliverInternalReportDto {
  @ApiProperty({ enum: INTERNAL_REPORT_TYPES })
  @IsIn(INTERNAL_REPORT_TYPES)
  reportType!: (typeof INTERNAL_REPORT_TYPES)[number];

  @ApiProperty()
  @IsDateString()
  from!: string;

  @ApiProperty()
  @IsDateString()
  to!: string;

  @ApiProperty()
  @IsUUID()
  recipientUserId!: string;

  @ApiPropertyOptional({ enum: ['aggregate'] })
  @IsOptional()
  @IsIn(['aggregate'])
  exportScope?: 'aggregate';
}

export class RedeemSharedReportDto {
  @ApiProperty()
  @IsString()
  token!: string;
}

export class DeliverGovernmentNotificationDto {
  @ApiProperty({ enum: ['failure', 'acknowledgement'] })
  @IsIn(['failure', 'acknowledgement'])
  kind!: 'failure' | 'acknowledgement';

  @ApiProperty({ example: 'SHA' })
  @IsString()
  integration!: string;

  @ApiProperty()
  @IsString()
  detail!: string;

  @ApiProperty()
  @IsEmail()
  recipientEmail!: string;
}
