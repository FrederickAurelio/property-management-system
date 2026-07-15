import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';
import { type ApiSuccess, isApiSuccessEnvelope } from '@cabin/api-contract';
import { getRequestId } from './request-id.middleware.js';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccess<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccess<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = getRequestId(request);

    return next.handle().pipe(
      map((payload) => {
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
