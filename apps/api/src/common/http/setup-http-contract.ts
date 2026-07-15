import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor.js';
import { HttpExceptionFilter } from './http-exception.filter.js';
import { requestIdMiddleware } from './request-id.middleware.js';

/** Shared HTTP contract: request id, validation, envelope, errors. */
export function setupHttpContract(app: INestApplication): void {
  app.use(requestIdMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
}
