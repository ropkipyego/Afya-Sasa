import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BiometricCandidateDto {
  @ApiProperty()
  @IsString()
  externalSubjectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class BiometricAgentPayloadDto {
  @ApiProperty()
  @IsString()
  deviceKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceSecret?: string;

  @ApiPropertyOptional({ description: 'HMAC-SHA256(deviceSecret, nonce + capturedAt). Prefer this over sending the secret through the browser.' })
  @IsOptional()
  @IsString()
  deviceHmac?: string;

  @ApiProperty({ enum: ['enroll', 'verify', 'identify', 'status', 'test'] })
  @IsIn(['enroll', 'verify', 'identify', 'status', 'test'])
  operation!: 'enroll' | 'verify' | 'identify' | 'status' | 'test';

  @ApiProperty({
    enum: [
      'verified',
      'not_verified',
      'no_match',
      'multiple_candidates',
      'device_error',
      'timeout',
      'cancelled',
      'enrolled',
    ],
  })
  @IsIn([
    'verified',
    'not_verified',
    'no_match',
    'multiple_candidates',
    'device_error',
    'timeout',
    'cancelled',
    'enrolled',
  ])
  result!:
    | 'verified'
    | 'not_verified'
    | 'no_match'
    | 'multiple_candidates'
    | 'device_error'
    | 'timeout'
    | 'cancelled'
    | 'enrolled';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalSubjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  confidence?: number;

  @ApiPropertyOptional({ type: [BiometricCandidateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiometricCandidateDto)
  candidates?: BiometricCandidateDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  capturedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nonce?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastError?: string;

  @ApiPropertyOptional({ description: 'Official SDK quality label only. Never invented by AfyaSasa.' })
  @IsOptional()
  @IsString()
  qualityLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  qualityScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fingerPosition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readerState?: string;
}

export class RegisterBiometricDeviceDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceKey?: string;
}

export const BIOMETRIC_FINGERS = [
  'right_thumb',
  'right_index',
  'right_middle',
  'left_thumb',
  'left_index',
  'left_middle',
  'other',
] as const;

export class EnrollBiometricDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional({ enum: BIOMETRIC_FINGERS })
  @IsOptional()
  @IsIn(BIOMETRIC_FINGERS)
  fingerPosition?: (typeof BIOMETRIC_FINGERS)[number];

  @ApiProperty({ type: BiometricAgentPayloadDto })
  @ValidateNested()
  @Type(() => BiometricAgentPayloadDto)
  capture!: BiometricAgentPayloadDto;
}

export class VerifyBiometricDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty({ type: BiometricAgentPayloadDto })
  @ValidateNested()
  @Type(() => BiometricAgentPayloadDto)
  capture!: BiometricAgentPayloadDto;
}

export class IdentifyBiometricDto {
  @ApiProperty({ type: BiometricAgentPayloadDto })
  @ValidateNested()
  @Type(() => BiometricAgentPayloadDto)
  capture!: BiometricAgentPayloadDto;
}

export class DeviceHeartbeatDto {
  @ApiProperty()
  @IsString()
  deviceKey!: string;

  @ApiProperty()
  @IsString()
  deviceSecret!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['online', 'offline'])
  status?: 'online' | 'offline';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastError?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['SDK_UNAVAILABLE', 'DEVICE_DISCONNECTED', 'DEVICE_READY', 'ERROR'])
  readerState?: 'SDK_UNAVAILABLE' | 'DEVICE_DISCONNECTED' | 'DEVICE_READY' | 'ERROR';
}
