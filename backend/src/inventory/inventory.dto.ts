import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: ['pharmaceutical', 'medical_consumable', 'non_medical'] })
  @IsIn(['pharmaceutical', 'medical_consumable', 'non_medical'])
  category!: 'pharmaceutical' | 'medical_consumable' | 'non_medical';

  @ApiProperty({ example: 'tablet' })
  @IsString()
  unit!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackBatch?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dosageForm?: string;
}

  export class UpdateInventoryItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dosageForm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxLevel?: number;
}

export class ReceiveStockDto {
  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiProperty()
  @IsString()
  locationId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DispensePharmacyDto {
  @ApiProperty()
  @IsString()
  clinicalOrderId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity?: number;
}

export class DispensePrescriptionLineDto {
  @ApiProperty()
  @IsString()
  clinicalOrderId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rejected?: boolean;
}

export class DispensePrescriptionDto {
  @ApiProperty({ description: 'Required confirmation for the atomic dispense commit.' })
  @IsBoolean()
  confirm!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prescriptionGroupId?: string;

  @ApiProperty({ type: [DispensePrescriptionLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispensePrescriptionLineDto)
  lines!: DispensePrescriptionLineDto[];
}

export class PreparePrescriptionDto {
  @ApiProperty({ type: [DispensePrescriptionLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispensePrescriptionLineDto)
  lines!: DispensePrescriptionLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prescriptionGroupId?: string;
}

export class CancelPharmacySaleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  saleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReturnIssuedPharmacySaleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  saleId!: string;

  @ApiProperty({ description: 'Why the issued medicine is coming back to stock' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class DispenseOtcDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Client sale id. Repeated posts with the same id do not deduct stock twice.' })
  @IsOptional()
  @IsString()
  saleId?: string;
}

export class PrepareOtcLineDto {
  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

export class PrepareOtcCartDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  saleId!: string;

  @ApiPropertyOptional({ type: [PrepareOtcLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrepareOtcLineDto)
  lines?: PrepareOtcLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  walkInName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  walkInPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRequisitionLineDto {
  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

export class CreateRequisitionDto {
  @ApiProperty({ example: 'General Ward' })
  @IsString()
  requestingDepartment!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateRequisitionLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequisitionLineDto)
  lines!: CreateRequisitionLineDto[];
}

export class ImportInventoryCsvDto {
  @ApiProperty()
  @IsString()
  csv!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({
    description:
      'catalogue = products/prices only. receipt = goods receipt of listed qty. stock_take = adjust to counted qty. confirmStockTake without intent means stock_take, not a receipt.',
    enum: ['catalogue', 'receipt', 'stock_take'],
  })
  @IsOptional()
  @IsIn(['catalogue', 'receipt', 'stock_take'])
  importIntent?: 'catalogue' | 'receipt' | 'stock_take';

  @ApiPropertyOptional({
    description:
      'Required to post a stock_take or receipt import. Preview never writes. Catalogue imports do not move stock even when this is true.',
  })
  @IsOptional()
  @IsBoolean()
  confirmStockTake?: boolean;

  @ApiPropertyOptional({ description: 'Client-generated id used to reject duplicate posts.' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Validate and classify rows without writing.' })
  @IsOptional()
  @IsBoolean()
  previewOnly?: boolean;

  @ApiPropertyOptional({
    description: 'When true, overwrite name/class/unit/price on matched products. Default leaves existing catalogue rows unchanged.',
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;
}

export class UpdateItemPricingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  markup?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sell?: number;
}

export class BulkPricingDto {
  @ApiProperty({ enum: ['percent_markup', 'add_amount', 'set_sell'] })
  @IsIn(['percent_markup', 'add_amount', 'set_sell'])
  mode!: 'percent_markup' | 'add_amount' | 'set_sell';

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @ApiPropertyOptional({ enum: ['pharmaceutical', 'medical_consumable', 'non_medical'] })
  @IsOptional()
  @IsIn(['pharmaceutical', 'medical_consumable', 'non_medical'])
  category?: 'pharmaceutical' | 'medical_consumable' | 'non_medical';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class CreateTransferDto {
  @ApiProperty()
  @IsString()
  sourceLocationId!: string;

  @ApiProperty()
  @IsString()
  destinationLocationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateRequisitionLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequisitionLineDto)
  lines!: CreateRequisitionLineDto[];
}

export class CreateStockTakeSessionDto {
  @ApiProperty()
  @IsString()
  locationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CountStockTakeLineDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedQty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectStockTakeDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

export class ImportStockTakeCountsDto {
  @ApiProperty()
  @IsString()
  csv!: string;
}
