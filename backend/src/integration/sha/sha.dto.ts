import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { SHA_IDENTIFICATION_TYPES } from './sha.types';

export class CheckShaEligibilityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ enum: SHA_IDENTIFICATION_TYPES })
  @IsOptional()
  @IsString()
  @IsIn([...SHA_IDENTIFICATION_TYPES, 'national_id', 'client_registry', 'birth_notification', 'birth_certificate', 'alien_id', 'refugee_id', 'mandate_number'])
  identificationType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  identificationNumber?: string;
}
