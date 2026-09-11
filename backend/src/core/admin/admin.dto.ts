import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export class CreateUserDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Employee number is required' })
  employeeNo!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName!: string;

  @ApiProperty()
  @Transform(trimString)
  @IsEmail({}, { message: 'A valid email is required' })
  email!: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10, { message: 'Temporary password must be at least 10 characters' })
  temporaryPassword!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true, message: 'Each role must be a valid id' })
  roleIds?: string[];

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  specialisation?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AssignRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one role is required' })
  @IsUUID('all', { each: true, message: 'Each role must be a valid id' })
  roleIds!: string[];
}

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  permissionIds?: string[];
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  permissionIds!: string[];
}

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smsSenderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientIdPrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  triageSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  clinicalCatalog?: Record<string, unknown>;
}

export class CreateDepartmentDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateClinicDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  doctorIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  consultationFee?: number;
}

export class UpdateClinicDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  doctorIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  consultationFee?: number;
}

export class ResetUserPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  temporaryPassword!: string;
}

export class AssignDepartmentDto {
  @ApiProperty()
  @IsString()
  departmentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
