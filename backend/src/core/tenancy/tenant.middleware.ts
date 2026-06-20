import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { RequestContext } from '../../common/request-context';
import { TenancyService } from './tenancy.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenancyService: TenancyService) {}

  async use(
    request: RequestContext,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    if (request.path.startsWith('/api/v1/health') || request.path === '/docs') {
      next();
      return;
    }

    const identifier = this.tenancyService.extractTenantIdentifier(
      request.headers.host,
      request.headers['x-tenant'],
    );

    if (!identifier) {
      throw new BadRequestException('Tenant header or subdomain is required');
    }

    request.tenant = await this.tenancyService.resolveTenant(identifier);
    next();
  }
}
