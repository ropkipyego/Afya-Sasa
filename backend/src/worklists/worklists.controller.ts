import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../core/auth/auth.decorators';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { WorklistsService, type WorklistModule } from './worklists.service';

@ApiBearerAuth()
@ApiTags('Worklists')
@Controller('worklists')
export class WorklistsController {
  constructor(private readonly worklists: WorklistsService) {}

  @Get()
  @RequirePermissions('worklists:read')
  catalog() {
    return this.worklists.availableLists();
  }

  @Get(':module/:listKey')
  @RequirePermissions('worklists:read')
  list(
    @Param('module') module: WorklistModule,
    @Param('listKey') listKey: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.worklists.list(module, listKey, query);
  }
}
