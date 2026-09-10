import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
  @IsNumber()
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
