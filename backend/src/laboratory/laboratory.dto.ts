import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreateLabPanelDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['haematology', 'biochemistry', 'microbiology', 'immunology', 'urinalysis', 'coagulation'] })
  @IsIn(['haematology', 'biochemistry', 'microbiology', 'immunology', 'urinalysis', 'coagulation'])
  category!: 'haematology' | 'biochemistry' | 'microbiology' | 'immunology' | 'urinalysis' | 'coagulation';
}

export class CreateLabTestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  panelId?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty({ enum: ['whole_blood', 'serum', 'plasma', 'urine', 'swab', 'stool', 'csf', 'tissue'] })
  @IsIn(['whole_blood', 'serum', 'plasma', 'urine', 'swab', 'stool', 'csf', 'tissue'])
  sampleType!: 'whole_blood' | 'serum' | 'plasma' | 'urine' | 'swab' | 'stool' | 'csf' | 'tissue';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  turnaroundHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceRange?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  criticalLow?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  criticalHigh?: number;
}

export class CreateLabRequestDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  admissionId?: string;

  @ApiProperty({ enum: ['routine', 'urgent', 'stat'] })
  @IsIn(['routine', 'urgent', 'stat'])
  priority!: 'routine' | 'urgent' | 'stat';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  testIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  panelIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Orderable catalog test/panel IDs' })
  @IsOptional()
  @IsArray()
  orderableTestIds?: string[];

  @ApiPropertyOptional({ enum: ['cash', 'mpesa', 'card', 'insurance', 'quickbooks', 'waived'] })
  @IsOptional()
  @IsIn(['cash', 'mpesa', 'card', 'insurance', 'quickbooks', 'waived'])
  paymentMethod?: 'cash' | 'mpesa' | 'card' | 'insurance' | 'quickbooks' | 'waived';

  @ApiPropertyOptional({ description: 'Insurance scheme code e.g. sha, jubilee' })
  @IsOptional()
  @IsString()
  payerScheme?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mpesaPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  billingAmount?: number;

  @ApiPropertyOptional({ enum: ['self_request', 'walk_in', 'referral'] })
  @IsOptional()
  @IsIn(['self_request', 'walk_in', 'referral'])
  walkInSource?: 'self_request' | 'walk_in' | 'referral';
}

export class CollectSampleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}

export class ReceiveSampleDto {
  @ApiProperty({ enum: ['adequate', 'haemolysed', 'clotted', 'insufficient', 'contaminated'] })
  @IsIn(['adequate', 'haemolysed', 'clotted', 'insufficient', 'contaminated'])
  condition!: 'adequate' | 'haemolysed' | 'clotted' | 'insufficient' | 'contaminated';
}

export class CreateLabAttachmentDto {
  @ApiProperty()
  @IsString()
  filename!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @IsString()
  storagePath!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;
}

export class ImportLabCatalogDto {
  @ApiProperty({ description: 'CSV content with header row' })
  @IsString()
  csv!: string;
}

export class EnterLabResultDto {
  @ApiProperty()
  @IsString()
  requestItemId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sampleId?: string;

  @ApiProperty()
  @IsString()
  value!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parameterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parameterCode?: string;
}

export class EnterLabPanelResultValueDto {
  @ApiProperty()
  @IsString()
  parameterCode!: string;

  @ApiProperty()
  @IsString()
  value!: string;
}

export class EnterLabPanelResultsDto {
  @ApiProperty()
  @IsString()
  requestItemId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sampleId?: string;

  @ApiProperty({ type: [EnterLabPanelResultValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnterLabPanelResultValueDto)
  results!: EnterLabPanelResultValueDto[];
}

export class UpdateLabTestPricingDto {
  @ApiProperty({ example: 800 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sell!: number;
}
