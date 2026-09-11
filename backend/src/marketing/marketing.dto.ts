import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MARKETING_ACTIVITY_TYPES, MARKETING_OUTCOMES } from './marketing.constants';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function optionalBoolean({ value }: { value: unknown }) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
}

export class CreateMarketingActivityDto {
  @ApiProperty({ example: '2026-09-11' })
  @Transform(trimString)
  @IsDateString({}, { message: 'Activity date is required' })
  activityDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Facility or organization is required' })
  facilityName!: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @Matches(/^[+\d][\d\s\-()]{6,19}$/, {
    message: 'Phone must be a sensible contact number',
  })
  contactPhone?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty({ enum: MARKETING_ACTIVITY_TYPES })
  @Transform(trimString)
  @IsIn([...MARKETING_ACTIVITY_TYPES], { message: 'Select a valid activity type' })
  activityType!: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  servicesPromoted?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'People reached must be a whole number' })
  @Min(0, { message: 'People reached cannot be negative' })
  peopleReached?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Leads generated must be a whole number' })
  @Min(0, { message: 'Leads generated cannot be negative' })
  leadsGenerated?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Referrals generated must be a whole number' })
  @Min(0, { message: 'Referrals generated cannot be negative' })
  referralsGenerated?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({}, { message: 'Follow-up date must be a valid date' })
  followUpDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  followUpCompleted?: boolean;

  @ApiPropertyOptional({ enum: MARKETING_OUTCOMES })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsIn([...MARKETING_OUTCOMES], { message: 'Select a valid outcome' })
  outcome?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  nextAction?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMarketingActivityDto extends PartialType(CreateMarketingActivityDto) {}

export class ListMarketingActivitiesQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  facility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([...MARKETING_ACTIVITY_TYPES])
  activityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([...MARKETING_OUTCOMES])
  outcome?: string;

  @ApiPropertyOptional({ enum: ['required', 'completed', 'overdue', 'none'] })
  @IsOptional()
  @IsIn(['required', 'completed', 'overdue', 'none'])
  followUp?: 'required' | 'completed' | 'overdue' | 'none';

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** Legacy daily-report payload — mapped onto the transactional activity. */
export class CreateMarketingVisitDto {
  @ApiProperty()
  @IsDateString()
  visitDate!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  officerName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  facilityName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  activity!: string;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  peopleReached!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextAction?: string;
}

export class ImportMarketingCatalogDto {
  @ApiProperty()
  @IsString()
  csv!: string;
}
