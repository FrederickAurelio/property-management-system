import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import { type ApiSuccess, isApiSuccessEnvelope } from '@cabin/api-contract';
import { getRequestId } from './request-id.middleware.js';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccess<T> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccess<T> | T> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = getRequestId(request);

    // Public .ics uses @Res() and writes the body itself — do not wrap.
    if (
      request.path.includes('/public/ical/') &&
      request.path.endsWith('.ics')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((payload) => {
        if (response.headersSent) {
          return payload;
        }
        if (isApiSuccessEnvelope(payload)) {
          return {
            data: payload.data as T,
            meta: {
              ...payload.meta,
              ...(requestId ? { requestId } : {}),
            },
          };
        }

        return {
          data: payload,
          ...(requestId ? { meta: { requestId } } : {}),
        };
      }),
    );
  }
}
