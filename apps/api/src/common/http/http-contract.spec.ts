import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import { ApiErrorCode, ApiFieldReason } from '@cabin/api-contract';
import { HttpExceptionFilter } from './http-exception.filter';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('TransformInterceptor', () => {
  it('wraps plain payloads in data + meta.requestId', async () => {
    const interceptor = new TransformInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'req_test' }),
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
});
