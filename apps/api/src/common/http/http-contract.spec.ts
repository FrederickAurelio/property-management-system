import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import { ApiErrorCode, ApiFieldReason } from '@cabin/api-contract';
import { HttpExceptionFilter } from './http-exception.filter';
import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

describe('TransformInterceptor', () => {
  it('wraps plain payloads in data + meta.requestId', async () => {
    const interceptor = new TransformInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'req_test', path: '/staff/health' }),
        getResponse: () => ({ headersSent: false }),
      }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ status: 'ok' }),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));
    expect(result).toEqual({
      data: { status: 'ok' },
      meta: { requestId: 'req_test' },
    });
  });
});

describe('HttpExceptionFilter', () => {
  it('maps UnauthorizedException to AUTH_UNAUTHORIZED envelope', () => {
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    filter.catch(new UnauthorizedException('Not authenticated'), {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ requestId: 'req_err' }),
      }),
    } as never);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: ApiErrorCode.AUTH_UNAUTHORIZED,
        message: 'Not authenticated',
      },
      meta: { requestId: 'req_err' },
    });
  });

  it('forwards custom details on ConflictException', () => {
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    filter.catch(
      new ConflictException({
        message: 'Username is already taken',
        details: {
          field: 'username',
          reason: ApiFieldReason.USERNAME_TAKEN,
        },
      }),
      {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => ({ requestId: 'req_conflict' }),
        }),
      } as never,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: ApiErrorCode.CONFLICT,
        message: 'Username is already taken',
        details: {
          field: 'username',
          reason: ApiFieldReason.USERNAME_TAKEN,
        },
      },
      meta: { requestId: 'req_conflict' },
    });
  });

  it('forwards explicit LOGS_UNAVAILABLE on 503', () => {
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    filter.catch(
      new ServiceUnavailableException({
        message: 'Request log store is unavailable.',
        code: ApiErrorCode.LOGS_UNAVAILABLE,
      }),
      {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => ({ requestId: 'req_logs' }),
        }),
      } as never,
    );

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: ApiErrorCode.LOGS_UNAVAILABLE,
        message: 'Request log store is unavailable.',
      },
      meta: { requestId: 'req_logs' },
    });
  });

  it('keeps the FE 500 generic and stores the thrown Error on the request log', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const filter = new HttpExceptionFilter();
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const locals: Record<string, unknown> = {};

      filter.catch(
        new TypeError("Cannot read properties of undefined (reading 'id')"),
        {
          switchToHttp: () => ({
            getResponse: () => ({ status, locals }),
            getRequest: () => ({
              requestId: 'req_boom',
              method: 'GET',
              url: '/staff/x',
            }),
          }),
        } as never,
      );

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
        },
        meta: { requestId: 'req_boom' },
      });
      expect(locals.errorCode).toBe(ApiErrorCode.INTERNAL_ERROR);
      expect(locals.errorMessage).toBe(
        "TypeError: Cannot read properties of undefined (reading 'id')",
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
