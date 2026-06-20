import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { RequestContext } from '../../common/request-context';
import { AuditService } from './audit.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<RequestContext>();
    const response = http.getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      tap(() => {
        if (!MUTATING_METHODS.has(request.method)) {
          return;
        }

        void this.auditService.record({
          userId: request.user?.sub ?? null,
          action: request.method.toLowerCase(),
          recordType: request.route?.path ?? null,
          recordId:
            typeof request.params?.id === 'string' ? request.params.id : null,
          beforeJson: null,
          afterJson: null,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
          sessionId: request.headers['x-session-id']?.toString() ?? null,
          endpoint: request.originalUrl,
          httpCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        });
      }),
    );
  }
}
