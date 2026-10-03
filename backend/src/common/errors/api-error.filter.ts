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
import { ERROR_CODES, inferErrorCode, safePublicMessage } from './error-codes';

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
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

    const rawMessage =
      exception instanceof HttpException
        ? flattenMessage(exception.getResponse())
        : exception instanceof Error
          ? exception.message
          : 'Unexpected error';

    const driverError =
      exception && typeof exception === 'object' && 'code' in exception
        ? String((exception as { code?: string }).code ?? '')
        : '';
    const isDatabaseError =
      driverError.startsWith('23') ||
      driverError.startsWith('22') ||
      /queryfailederror|duplicate key|foreign key/i.test(
        exception instanceof Error ? exception.name + exception.message : '',
      );

    const code = isDatabaseError
      ? ERROR_CODES.DATABASE_ERROR
      : inferErrorCode(status, rawMessage);
    const publicDetails = rawMessage && !isSensitive(rawMessage) ? rawMessage : undefined;
    const message = safePublicMessage(status, publicDetails);

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
      }),
    );

    const body: ErrorBody = {
      success: false,
      error: {
        code,
        message,
        details: publicDetails && publicDetails !== message ? publicDetails : undefined,
      },
      requestId,
    };

    response.status(status).json(body);
  }
}
