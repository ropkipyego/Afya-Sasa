import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { ClinicalOrderMirrorService } from './clinical-order-mirror.service';
import { IsOptional, IsString, MinLength } from 'class-validator';
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
}

@ApiBearerAuth()
@ApiTags('Clinical Orders')
@Controller('clinical-orders')
export class ClinicalOrderController {
  constructor(private readonly orders: ClinicalOrderMirrorService) {}

  @Get()
  @RequirePermissions('lab_requests:read')
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
  @RequirePermissions('consultations:create')
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
      },
      request,
    );
  }
}
