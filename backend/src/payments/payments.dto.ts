import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import type { PaymentServiceLine } from './payment.entities';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

const SERVICE_LINES = [
  'consultation',
  'pharmacy',
  'laboratory',
  'radiology',
  'inpatient',
  'other',
] as const;

export class InitiateMpesaStkDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ enum: SERVICE_LINES })
  @IsIn(SERVICE_LINES)
  serviceLine!: PaymentServiceLine;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceDescription?: string;

  /** @deprecated use serviceEntityId with serviceLine laboratory */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  labRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiProperty({ example: '254712345678' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class RecordManualPaymentDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ enum: SERVICE_LINES })
  @IsIn(SERVICE_LINES)
  serviceLine!: PaymentServiceLine;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceDescription?: string;

  /** @deprecated use serviceEntityId with serviceLine laboratory */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  labRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiProperty({ enum: ['cash', 'card', 'insurance', 'quickbooks', 'waived'] })
  @IsIn(['cash', 'card', 'insurance', 'quickbooks', 'waived'])
  method!: 'cash' | 'card' | 'insurance' | 'quickbooks' | 'waived';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerScheme?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Amount cannot be negative' })
  amount?: number;
}

export class ImportOrderableCatalogDto {
  @ApiProperty({ description: 'CSV with orderable LIS tests' })
  @IsString()
  csv!: string;
}
