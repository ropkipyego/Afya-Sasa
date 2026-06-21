import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { RequestContext } from '../../common/request-context';
import { AuditService } from './audit.service';

const AUDITED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export function actionFromRequest(method: string, endpoint: string) {
  if (endpoint.includes('download')) return 'download';
  if (endpoint.includes('export')) return 'export';
  if (endpoint.includes('print')) return 'print';
  if (method === 'GET') return 'read';
  if (method === 'POST') return 'create';
  if (method === 'DELETE') return 'delete';
  return 'update';
}

export function shouldSkipAudit(endpoint: string) {
  return (
    endpoint.includes('/health') ||
    endpoint.startsWith('/docs') ||
    endpoint.includes('/swagger')
  );
}

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
        if (
          !AUDITED_METHODS.has(request.method) ||
          shouldSkipAudit(request.originalUrl)
        ) {
          return;
        }

        void this.auditService.record({
          userId: request.user?.sub ?? null,
          action: actionFromRequest(request.method, request.originalUrl),
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
