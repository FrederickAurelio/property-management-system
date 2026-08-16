import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  INestApplication,
  Module,
  Post,
  type Type,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiErrorCode, type ApiErrorBody } from '@cabin/api-contract';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupHttpContract } from '../setup-http-contract';
import { CabinThrottlerGuard } from './cabin-throttler.guard';
import { throttlerModuleOptions } from './throttler.options';

@Controller()
class HealthController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}

@Controller('staff/auth')
class LoginController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(): { ok: true } {
    return { ok: true };
  }
}

@Controller('staff/admins')
class AdminsController {
  @Get()
  list(): { items: never[] } {
    return { items: [] };
  }
}

@Controller('public/ical')
class PublicIcalController {
  @Get('units/:unitId.ics')
  ics(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot(
      throttlerModuleOptions({
        authLimit: 3,
        authTtlMs: 60_000,
        authUserLimit: 100,
        authUserTtlMs: 60_000,
        defaultLimit: 120,
        globalLimit: 300,
      }),
    ),
  ],
  controllers: [HealthController, LoginController, AdminsController],
  providers: [{ provide: APP_GUARD, useClass: CabinThrottlerGuard }],
})
class AuthIpThrottleModule {}

@Module({
  imports: [
    ThrottlerModule.forRoot(
      throttlerModuleOptions({
        authLimit: 100,
        authTtlMs: 60_000,
        authUserLimit: 3,
        authUserTtlMs: 60_000,
        defaultLimit: 120,
        globalLimit: 300,
      }),
    ),
  ],
  controllers: [LoginController],
  providers: [{ provide: APP_GUARD, useClass: CabinThrottlerGuard }],
})
class AuthUserThrottleModule {}

@Module({
  imports: [
    ThrottlerModule.forRoot(
      throttlerModuleOptions({
        defaultLimit: 5,
        globalLimit: 8,
        icalLimit: 50,
        icalTtlMs: 60_000,
      }),
    ),
  ],
  controllers: [PublicIcalController],
  providers: [{ provide: APP_GUARD, useClass: CabinThrottlerGuard }],
})
class IcalBurstThrottleModule {}

@Module({
  imports: [
    ThrottlerModule.forRoot(
      throttlerModuleOptions({
        icalLimit: 3,
        icalTtlMs: 60_000,
      }),
    ),
  ],
  controllers: [PublicIcalController],
  providers: [{ provide: APP_GUARD, useClass: CabinThrottlerGuard }],
})
class IcalCapThrottleModule {}

async function createApp(mod: Type<unknown>): Promise<INestApplication<App>> {
  const fixture = await Test.createTestingModule({
    imports: [mod],
  }).compile();
  const app = fixture.createNestApplication();
  setupHttpContract(app);
  await app.init();
  return app;
}

describe('CabinThrottlerGuard HTTP', () => {
  describe('auth IP bucket', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp(AuthIpThrottleModule);
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns RATE_LIMITED on the 4th login', async () => {
      for (let i = 0; i < 3; i += 1) {
        await request(app.getHttpServer())
          .post('/staff/auth/login')
          .send({ username: 'desk', password: 'secret' })
          .expect(200);
      }

      const res = await request(app.getHttpServer())
        .post('/staff/auth/login')
        .send({ username: 'desk', password: 'secret' })
        .expect(429);

      const body = res.body as ApiErrorBody;
      expect(body.error.code).toBe(ApiErrorCode.RATE_LIMITED);
      expect(body.error.message).toBe(
        'Too many requests. Try again in a few minutes.',
      );
      expect(body.meta?.requestId).toEqual(expect.any(String));
    });

    it('does not throttle GET /health in a loop', async () => {
      for (let i = 0; i < 15; i += 1) {
        await request(app.getHttpServer()).get('/health').expect(200);
      }
    });

    it('does not apply the auth bucket to GET /staff/admins', async () => {
      for (let i = 0; i < 5; i += 1) {
        await request(app.getHttpServer()).get('/staff/admins').expect(200);
      }
    });
  });

  describe('auth username bucket', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp(AuthUserThrottleModule);
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns RATE_LIMITED on the 4th login for the same username', async () => {
      for (let i = 0; i < 3; i += 1) {
        await request(app.getHttpServer())
          .post('/staff/auth/login')
          .send({ username: 'victim', password: 'secret' })
          .expect(200);
      }

      const res = await request(app.getHttpServer())
        .post('/staff/auth/login')
        .send({ username: 'victim', password: 'secret' })
        .expect(429);

      expect((res.body as ApiErrorBody).error.code).toBe(
        ApiErrorCode.RATE_LIMITED,
      );
    });
  });

  describe('public iCal bucket', () => {
    it('does not apply default/global caps to an OTA unit burst', async () => {
      const app = await createApp(IcalBurstThrottleModule);
      try {
        for (let i = 0; i < 20; i += 1) {
          await request(app.getHttpServer())
            .get(`/public/ical/units/unit-${String(i)}.ics`)
            .expect(200);
        }
      } finally {
        await app.close();
      }
    });

    it('still 429s when the iCal IP cap is exceeded', async () => {
      const app = await createApp(IcalCapThrottleModule);
      try {
        for (let i = 0; i < 3; i += 1) {
          await request(app.getHttpServer())
            .get(`/public/ical/units/unit-${String(i)}.ics`)
            .expect(200);
        }
        const res = await request(app.getHttpServer())
          .get('/public/ical/units/unit-3.ics')
          .expect(429);
        expect((res.body as ApiErrorBody).error.code).toBe(
          ApiErrorCode.RATE_LIMITED,
        );
      } finally {
        await app.close();
      }
    });
  });
});
