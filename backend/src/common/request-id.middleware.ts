import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Response } from 'express';
import type { RequestContext } from './request-context';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestContext, response: Response, next: NextFunction) {
    const incoming =
      request.header('x-request-id')?.trim() ||
      request.header('x-correlation-id')?.trim() ||
      randomUUID();
    request.headers['x-request-id'] = incoming;
    response.setHeader('X-Request-Id', incoming);
    next();
  }
}
