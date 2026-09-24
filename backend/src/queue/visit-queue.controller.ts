import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { VisitQueueService } from './visit-queue.service';
import type { VisitQueueStatus, VisitQueueType } from './visit-queue.entities';

const QUEUE_TYPES = [
  'OPD',
  'LAB',
  'RAD',
  'PHARM',
  'CASH',
  'ED',
  'IPD',
  'THEATRE',
  'MAT',
  'ICU',
  'HDU',
] as const;

const QUEUE_STATUSES = [
  'WAITING',
  'CALLED',
  'IN_SERVICE',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
  'TRANSFERRED',
] as const;

class TransferQueueDto {
  @IsIn(QUEUE_TYPES)
  queueType!: VisitQueueType;
}

class UpdateQueueStatusDto {
  @IsIn(QUEUE_STATUSES)
  status!: VisitQueueStatus;
}

class IssueQueueDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  encounterId?: string;

  @IsIn(QUEUE_TYPES)
  queueType!: VisitQueueType;
}

@ApiBearerAuth()
@ApiTags('Visit queue')
@Controller('queue')
export class VisitQueueController {
  constructor(private readonly queue: VisitQueueService) {}

  @Get()
  @RequirePermissions('encounters:read', 'emergency:read', 'pharmacy:read', 'lab_requests:read')
  list(
    @Query('type') queueType?: VisitQueueType,
    @Query('date') date?: string,
    @Query('status') status?: VisitQueueStatus,
    @Query('patientId') patientId?: string,
  ) {
    return this.queue.list({ queueType, date, status, patientId });
  }

  @Get('current')
  @RequirePermissions('patients:read', 'encounters:read')
  current(@Query('patientId') patientId?: string) {
    if (!patientId) return [];
    return this.queue.currentForPatient(patientId);
  }

  @Post()
  @RequirePermissions('encounters:create', 'emergency:create')
  issue(@Body() dto: IssueQueueDto, @Req() request: RequestContext) {
    return this.queue.issue({
      patientId: dto.patientId,
      encounterId: dto.encounterId,
      queueType: dto.queueType,
      request,
    });
  }

  @Patch(':id/status')
  @RequirePermissions('encounters:update', 'emergency:create', 'pharmacy:dispense')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateQueueStatusDto,
    @Req() request: RequestContext,
  ) {
    return this.queue.transition(id, dto.status, request);
  }

  @Post(':id/transfer')
  @RequirePermissions('encounters:update', 'emergency:create')
  transfer(@Param('id') id: string, @Body() dto: TransferQueueDto, @Req() request: RequestContext) {
    return this.queue.transfer(id, dto.queueType, request);
  }
}
