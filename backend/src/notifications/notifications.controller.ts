import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString, MinLength } from 'class-validator';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { NotificationsService } from './notifications.service';

class BulkSmsDto {
  @ApiProperty({ type: [String], example: ['254712345678', '0712345678'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  mobiles!: string[];

  @ApiProperty({ example: 'Dear patient, your appointment is tomorrow at 9am. — Jalaram Hospital' })
  @IsString()
  @MinLength(1)
  message!: string;
}

@ApiBearerAuth()
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('inbox')
  @RequirePermissions('notifications:read')
  inbox(@Req() request: RequestContext, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationsService.listInbox(
      request.user!.sub,
      unreadOnly === 'true',
    );
  }

  @Get('inbox/summary')
  @RequirePermissions('notifications:read')
  inboxSummary(@Req() request: RequestContext) {
    return this.notificationsService.inboxSummary(request.user!.sub);
  }

  @Patch('inbox/:id/read')
  @RequirePermissions('notifications:read')
  markRead(@Param('id') id: string, @Req() request: RequestContext) {
    return this.notificationsService.markRead(id, request.user!.sub);
  }

  @Get('templates')
  @RequirePermissions('settings:manage')
  listTemplates() {
    return this.notificationsService.listTemplates();
  }

  @Patch('inbox/read-all')
  @RequirePermissions('notifications:read')
  markAllRead(@Req() request: RequestContext) {
    return this.notificationsService.markAllRead(request.user!.sub);
  }

  @Post('sms/bulk')
  @RequirePermissions('settings:manage')
  sendBulkSms(@Body() dto: BulkSmsDto, @Req() request: RequestContext) {
    return this.notificationsService.sendBulkSms({
      mobiles: dto.mobiles,
      message: dto.message,
      createdBy: request.user?.sub ?? null,
    });
  }

  @Get('sms/logs')
  @RequirePermissions('settings:manage')
  smsLogs(@Query('limit') limit?: string) {
    return this.notificationsService.listRecentSmsLogs(
      limit ? Number(limit) : 50,
    );
  }
}
