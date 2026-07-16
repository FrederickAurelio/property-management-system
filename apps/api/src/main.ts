import { NestFactory } from '@nestjs/core';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { AppModule } from './app.module';
import {
  STAFF_SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from './staff-auth/session.util';
import { setupHttpContract } from './common/http/setup-http-contract.js';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET is required');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (isProd && !process.env.CORS_ORIGINS?.trim()) {
    throw new Error('CORS_ORIGINS is required in production');
  }

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProd) {
    // Secure cookies need the real client protocol when TLS terminates upstream.
    app.set('trust proxy', 1);
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  setupHttpContract(app);

  const PgSession = connectPgSimple(session);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const cookie = sessionCookieOptions();

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: false,
      }),
      name: STAFF_SESSION_COOKIE_NAME,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
