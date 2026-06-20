import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

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

  @ApiProperty()
  @IsString()
  encounterId!: string;

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
}

export class CollectSampleDto {
  @ApiProperty()
  @IsString()
  type!: string;
}

export class ReceiveSampleDto {
  @ApiProperty({ enum: ['adequate', 'haemolysed', 'clotted', 'insufficient', 'contaminated'] })
  @IsIn(['adequate', 'haemolysed', 'clotted', 'insufficient', 'contaminated'])
  condition!: 'adequate' | 'haemolysed' | 'clotted' | 'insufficient' | 'contaminated';
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
}
