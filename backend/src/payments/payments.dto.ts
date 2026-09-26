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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chargeId?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chargeId?: string;

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

export class SaveHospitalChargeCatalogueDto {
  @ApiPropertyOptional()
  @IsOptional()
  policy?: {
    dayCount?: string;
    sameDay?: string;
    dayAnchor?: string;
    timeZone?: string;
    blockDischargeOnBalance?: boolean;
  };

  @ApiPropertyOptional()
  @IsOptional()
  items?: Array<{
    code: string;
    name: string;
    category?: string;
    chargeType?: string;
    unit?: string;
    unitPrice?: number | null;
    active?: boolean;
    automatic?: boolean;
    recurrence?: string;
    effectiveFrom?: string | null;
    wardTypes?: string[];
    payerPrices?: Record<string, number>;
    priceHistory?: Array<{ from: string; unitPrice: number }>;
  }>;
}

export class CreateManualChargeDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  admissionId?: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  chargeItemCode!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceDate?: string;
}

export class ImportOrderableCatalogDto {
  @ApiProperty({ description: 'CSV with orderable LIS tests' })
  @IsString()
  csv!: string;
}
