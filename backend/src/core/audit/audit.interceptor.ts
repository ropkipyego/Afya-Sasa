import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { RequestContext } from '../../common/request-context';
import {
  extractRecordId,
  sanitizeAuditPayload,
} from './audit-sanitize.util';
import { AuditService } from './audit.service';

const AUDITED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH']);

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

function recordTypeFromEndpoint(endpoint: string): string | null {
  const match = endpoint.match(/\/api\/v1\/([^/?]+)/);
  return match?.[1] ?? null;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<RequestContext>();
    const response = http.getResponse<{ statusCode: number }>();
    const requestBody = request.body;

    return next.handle().pipe(
      tap((result) => {
        if (
          !AUDITED_METHODS.has(request.method) ||
          shouldSkipAudit(request.originalUrl)
        ) {
          return;
        }

        const afterJson = MUTATION_METHODS.has(request.method)
          ? (sanitizeAuditPayload(
              result && typeof result === 'object' ? result : requestBody,
            ) as Record<string, unknown> | null)
          : result && typeof result === 'object'
            ? (sanitizeAuditPayload(result) as Record<string, unknown> | null)
            : null;

        void this.auditService.record({
          userId: request.user?.sub ?? null,
          action: actionFromRequest(request.method, request.originalUrl),
          recordType: recordTypeFromEndpoint(request.originalUrl),
          recordId: extractRecordId(
            request.params as Record<string, string | undefined>,
            requestBody,
            result,
          ),
          // Request body captured as before for mutations (entity load deferred to Phase 1C decorator)
          beforeJson: MUTATION_METHODS.has(request.method)
            ? (sanitizeAuditPayload(requestBody) as Record<string, unknown> | null)
            : null,
          afterJson,
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
