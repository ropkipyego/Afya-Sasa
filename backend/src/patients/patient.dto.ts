import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Gender, IdentifierType } from './patient.entities';

export class PatientIdentifierDto {
  @ApiProperty({ enum: ['national_id', 'sha', 'passport', 'birth_certificate', 'refugee_id'] })
  @IsIn(['national_id', 'sha', 'passport', 'birth_certificate', 'refugee_id'])
  type!: IdentifierType;

  @ApiProperty()
  @IsString()
  value!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class PatientNextOfKinDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'National ID, passport, or another identity number',
  })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiProperty()
  @IsString()
  relationship!: string;

  @ApiProperty()
  @IsString()
  primaryPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEmergencyContact?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class PatientAllergyDto {
  @ApiProperty()
  @IsString()
  allergen!: string;

  @ApiProperty({ enum: ['drug', 'food', 'environmental', 'latex', 'contrast'] })
  @IsIn(['drug', 'food', 'environmental', 'latex', 'contrast'])
  type!: 'drug' | 'food' | 'environmental' | 'latex' | 'contrast';

  @ApiProperty()
  @IsString()
  reaction!: string;

  @ApiProperty({
    enum: ['mild', 'moderate', 'severe', 'life_threatening'],
  })
  @IsIn(['mild', 'moderate', 'severe', 'life_threatening'])
  severity!: 'mild' | 'moderate' | 'severe' | 'life_threatening';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  onsetDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PatientChronicConditionDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icd10Code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  onsetDate?: string;

  @ApiProperty({ enum: ['active', 'controlled', 'resolved'] })
  @IsIn(['active', 'controlled', 'resolved'])
  status!: 'active' | 'controlled' | 'resolved';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePatientDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty()
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ enum: ['female', 'male', 'intersex', 'unknown'] })
  @IsIn(['female', 'male', 'intersex', 'unknown'])
  gender!: Gender;

  @ApiProperty()
  @IsString()
  primaryPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subCounty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  religion?: string;

  @ApiPropertyOptional({ type: [PatientIdentifierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatientIdentifierDto)
  identifiers?: PatientIdentifierDto[];

  @ApiPropertyOptional({ type: [PatientNextOfKinDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatientNextOfKinDto)
  nextOfKin?: PatientNextOfKinDto[];

  @ApiPropertyOptional({ type: [PatientAllergyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatientAllergyDto)
  allergies?: PatientAllergyDto[];

  @ApiPropertyOptional({ type: [PatientChronicConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatientChronicConditionDto)
  chronicConditions?: PatientChronicConditionDto[];
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}

export class UpdatePatientIdentifierDto extends PartialType(
  PatientIdentifierDto,
) {}

export class UpdatePatientNextOfKinDto extends PartialType(
  PatientNextOfKinDto,
) {}

export class UpdatePatientAllergyDto extends PartialType(PatientAllergyDto) {}

export class UpdatePatientChronicConditionDto extends PartialType(
  PatientChronicConditionDto,
) {}
