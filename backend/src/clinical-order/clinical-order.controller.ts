import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { ClinicalOrderMirrorService } from './clinical-order-mirror.service';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreatePharmacyOrderDto {
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

  @ApiProperty()
  @IsString()
  @MinLength(1)
  medication!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;
}

@ApiBearerAuth()
@ApiTags('Clinical Orders')
@Controller('clinical-orders')
export class ClinicalOrderController {
  constructor(private readonly orders: ClinicalOrderMirrorService) {}

  @Get()
  @RequirePermissions('pharmacy:read', 'pharmacy:prescribe', 'consultations:create', 'lab_requests:read')
  list(
    @Query('module') sourceModule?: string,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.orders.listOrders({
      sourceModule,
      status,
      patientId,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Post('pharmacy')
  @RequirePermissions('pharmacy:prescribe', 'consultations:create')
  createPharmacy(@Body() dto: CreatePharmacyOrderDto, @Req() request: RequestContext) {
    const orderNo = `RX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return this.orders.mirrorPharmacyOrder(
      {
        orderNo,
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        admissionId: dto.admissionId,
        status: 'requested',
        priority: dto.priority ?? 'routine',
        medication: dto.medication,
        dose: dto.dose,
        route: dto.route,
        frequency: dto.frequency,
        itemId: dto.itemId,
        quantity: dto.quantity,
        instructions: dto.instructions,
      },
      request,
    );
  }
}
