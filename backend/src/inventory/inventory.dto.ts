import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

export class DispenseOtcDto {
  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

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
