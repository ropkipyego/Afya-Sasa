import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestContext } from '../request-context';
import { ERROR_CODES, inferErrorCode, isRetryableError, nextActionFor, safePublicMessage } from './error-codes';
import { DomainHttpException } from './domain-exception';
import { buildHospitalStatusHtml } from './hospital-status-page';

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
    retryable: boolean;
    nextAction?: string;
    fields?: Record<string, string>;
  };
  requestId: string | null;
};

function isSensitive(text: string): boolean {
  return /(password|secret|token|authorization|fingerprint|biometric|postgres:\/\/|sqlstate|stack|node_modules|\/home\/)/i.test(
    text,
  );
}

function flattenMessage(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join(', ');
  }
  if (raw && typeof raw === 'object' && 'message' in raw) {
    return flattenMessage((raw as { message: unknown }).message);
  }
  return '';
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiError');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestContext>();
    const requestId =
      request.header?.('x-request-id') ??
      (typeof request.headers?.['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : null);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = exception instanceof HttpException ? exception.getResponse() : null;
    const structured =
      rawResponse && typeof rawResponse === 'object' && !Array.isArray(rawResponse)
        ? (rawResponse as {
            code?: string;
            message?: unknown;
            retryable?: boolean;
            nextAction?: string;
            fields?: Record<string, string>;
          })
        : null;

    const rawMessage =
      exception instanceof DomainHttpException
        ? exception.message
        : flattenMessage(rawResponse ?? (exception instanceof Error ? exception.message : 'Unexpected error'));

    const driverError =
      exception && typeof exception === 'object' && 'code' in exception && !(exception instanceof HttpException)
        ? String((exception as { code?: unknown }).code ?? '')
        : '';
    const isDatabaseError =
      driverError.startsWith('23') ||
      driverError.startsWith('22') ||
      /queryfailederror|duplicate key|foreign key/i.test(
        exception instanceof Error ? exception.name + exception.message : '',
      );

    const explicitCode =
      exception instanceof DomainHttpException
        ? exception.errorCode
        : typeof structured?.code === 'string'
          ? structured.code
          : null;
    const code = isDatabaseError
      ? ERROR_CODES.DATABASE_ERROR
      : explicitCode || inferErrorCode(status, rawMessage);
    const publicDetails = rawMessage && !isSensitive(rawMessage) ? rawMessage : undefined;
    const message = safePublicMessage(status, publicDetails);
    const retryable =
      exception instanceof DomainHttpException
        ? exception.retryable
        : Boolean(structured?.retryable) || isRetryableError(status, code);
    const nextAction =
      exception instanceof DomainHttpException
        ? exception.nextAction
        : structured?.nextAction || nextActionFor(code, retryable);
    const fields =
      exception instanceof DomainHttpException
        ? exception.fields
        : structured?.fields;

    this.logger.error(
      JSON.stringify({
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: (request.originalUrl ?? request.url ?? '').split('?')[0],
        method: request.method,
        userId: request.user?.sub ?? null,
        role: request.user?.roles?.[0] ?? null,
        errorCode: code,
        status,
        technicalError: exception instanceof Error ? exception.name : 'unknown',
        stack: status >= 500 && exception instanceof Error ? exception.stack : undefined,
      }),
    );

    const accept = String(request.headers?.accept ?? request.header?.('accept') ?? '');
    const wantsHtml = accept.includes('text/html');
    if (wantsHtml && (status === HttpStatus.NOT_FOUND || status >= 500)) {
      response.status(status).type('html').send(buildHospitalStatusHtml(status));
      return;
    }

    const body: ErrorBody = {
      success: false,
      error: {
        code,
        message,
        details: publicDetails && publicDetails !== message ? publicDetails : undefined,
        retryable,
        nextAction,
        fields,
      },
      requestId,
    };

    response.status(status).json(body);
  }
}
