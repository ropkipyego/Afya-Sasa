import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class ProvisionTenantDto {
  @ApiProperty({ example: 'Kenyatta National Hospital' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'knh', description: 'Unique tenant code and default subdomain' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*$/, {
    message: 'code must be lowercase letters, numbers, hyphens, or underscores',
  })
  code!: string;

  @ApiPropertyOptional({ example: 'knh' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*$/)
  subdomain?: string;

  @ApiPropertyOptional({ example: 'knh' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  schemaName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mohFacilityCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenceNumber?: string;

  @ApiPropertyOptional({ example: 'KNH' })
  @IsOptional()
  @IsString()
  patientIdPrefix?: string;

  @ApiPropertyOptional({ example: 'KNH Care' })
  @IsOptional()
  @IsString()
  smsSenderName?: string;

  @ApiProperty({ example: 'admin@knh.afyasasa.local' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: 'Grace' })
  @IsString()
  @IsNotEmpty()
  adminFirstName!: string;

  @ApiProperty({ example: 'Wanjiku' })
  @IsString()
  @IsNotEmpty()
  adminLastName!: string;

  @ApiPropertyOptional({ example: 'KNH-ADMIN' })
  @IsOptional()
  @IsString()
  adminEmployeeNo?: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(10)
  adminPassword!: string;
}

export class UpdateTenantStatusDto {
  @ApiProperty()
  @IsBoolean()
  active!: boolean;
}

export class TenantIdParamDto {
  @ApiProperty()
  @IsUUID()
  id!: string;
}
