import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable, from, switchMap } from 'rxjs';
import type { RequestContext } from '../../common/request-context';

const SAFE_SCHEMA = /^[a-z][a-z0-9_]*$/i;

@Injectable()
export class TenantSchemaInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestContext>();
    const schema = request.tenant?.schemaName ?? 'demo';

    if (!SAFE_SCHEMA.test(schema)) {
      throw new BadRequestException('Invalid tenant schema');
    }

    return from(this.dataSource.query(`SET LOCAL search_path TO "${schema}", public`)).pipe(
      switchMap(() => next.handle()),
    );
  }
}
