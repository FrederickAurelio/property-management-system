import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiErrorCode, type ApiErrorBody } from '@cabin/api-contract';
import { getRequestId } from './request-id.middleware.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = getRequestId(request);

    const { status, code, message, details } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorBody = {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      ...(requestId ? { meta: { requestId } } : {}),
    };

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const { message, details } = this.parseHttpExceptionResponse(
        exceptionResponse,
        exception.message,
      );

      return {
        status,
        code: this.codeForStatus(status, message, details),
        message,
        details,
      };
    }

    const isProd = process.env.NODE_ENV === 'production';
    if (exception instanceof Error) {
      const prismaHint = this.prismaSchemaHint(exception.message);
      if (prismaHint) {
        return {
          status: 503,
          code: ApiErrorCode.INTERNAL_ERROR,
          message: prismaHint,
        };
      }
    }
    return {
      status: 500,
      code: ApiErrorCode.INTERNAL_ERROR,
      message: isProd
        ? 'Internal server error'
        : exception instanceof Error
          ? exception.message
          : 'Internal server error',
    };
  }

  /** Missing tables / columns → tell desk to migrate instead of a Prisma dump. */
  private prismaSchemaHint(message: string): string | null {
    if (/does not exist in the current database/i.test(message)) {
      return 'Database schema is out of date. Run `pnpm --filter @cabin/api prisma:migrate` (or migrate deploy), then restart the API.';
    }
    return null;
  }

  private parseHttpExceptionResponse(
    exceptionResponse: string | object,
    fallbackMessage: string,
  ): { message: string; details?: unknown } {
    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse };
    }

    const record = exceptionResponse as {
      message?: string | string[];
      error?: string;
      details?: unknown;
    };

    if (Array.isArray(record.message)) {
      return {
        message: 'Validation failed',
        details: record.message,
      };
    }

    if (typeof record.message === 'string' && record.message.length > 0) {
      return {
        message: record.message,
        ...(record.details !== undefined ? { details: record.details } : {}),
      };
    }

    if (record.details !== undefined) {
      return { message: fallbackMessage, details: record.details };
    }

    return { message: fallbackMessage };
  }

  private codeForStatus(
    status: number,
    message: string,
    details?: unknown,
  ): string {
    if (status === 400) {
      if (details !== undefined || message === 'Validation failed') {
        return ApiErrorCode.VALIDATION_FAILED;
      }
      return ApiErrorCode.BAD_REQUEST;
    }
    if (status === 401) {
      return ApiErrorCode.AUTH_UNAUTHORIZED;
    }
    if (status === 403) {
      return ApiErrorCode.AUTH_FORBIDDEN;
    }
    if (status === 404) {
      return ApiErrorCode.NOT_FOUND;
    }
    if (status === 409) {
      return ApiErrorCode.CONFLICT;
    }
    if (status >= 500) {
      return ApiErrorCode.INTERNAL_ERROR;
    }
    return ApiErrorCode.BAD_REQUEST;
  }
}
