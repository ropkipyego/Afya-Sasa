import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { RequestContext } from './request-context';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<RequestContext>();
    const response = http.getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      tap({
        next: () => this.write(request, response.statusCode, startedAt),
        error: (error: { status?: number }) =>
          this.write(request, error.status ?? response.statusCode ?? 500, startedAt),
      }),
    );
  }

  private write(request: RequestContext, status: number, startedAt: number) {
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    if (path.includes('/health')) return;
    this.logger.log(
      JSON.stringify({
        operation: `${request.method} ${path}`,
        userId: request.user?.sub ?? null,
        tenant: request.tenant?.code ?? null,
        endpoint: path,
        requestId: request.header('x-request-id') ?? null,
        status,
        durationMs: Date.now() - startedAt,
      }),
    );
  }
}
