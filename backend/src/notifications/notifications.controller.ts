import { Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestContext } from '../common/request-context';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { NotificationsService } from './notifications.service';

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
}
