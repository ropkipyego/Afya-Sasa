import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from './error-codes';

export type DomainErrorBody = {
  code: ErrorCode | string;
  message: string;
  retryable?: boolean;
  nextAction?: string;
  fields?: Record<string, string>;
};

/**
 * Business denial with a stable machine code. The API filter copies these
 * fields into the public envelope. Never put PHI, SQL, or secrets in `message`.
 */
export class DomainHttpException extends HttpException {
  readonly errorCode: string;
  readonly retryable: boolean;
  readonly nextAction?: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, body: DomainErrorBody) {
    super(
      {
        code: body.code,
        message: body.message,
        retryable: body.retryable ?? false,
        nextAction: body.nextAction,
        fields: body.fields,
      },
      status,
    );
    this.errorCode = body.code;
    this.retryable = body.retryable ?? false;
    this.nextAction = body.nextAction;
    this.fields = body.fields;
  }
}

export function domainBadRequest(code: ErrorCode | string, message: string, extra?: Omit<DomainErrorBody, 'code' | 'message'>) {
  return new DomainHttpException(HttpStatus.BAD_REQUEST, { code, message, ...extra });
}

export function domainConflict(code: ErrorCode | string, message: string, extra?: Omit<DomainErrorBody, 'code' | 'message'>) {
  return new DomainHttpException(HttpStatus.CONFLICT, { code, message, ...extra });
}

export function domainForbidden(code: ErrorCode | string, message: string, extra?: Omit<DomainErrorBody, 'code' | 'message'>) {
  return new DomainHttpException(HttpStatus.FORBIDDEN, { code, message, ...extra });
}

export function domainNotFound(code: ErrorCode | string, message: string) {
  return new DomainHttpException(HttpStatus.NOT_FOUND, { code, message });
}

export const STOCK_UNAVAILABLE = ERROR_CODES.INSUFFICIENT_STOCK;
