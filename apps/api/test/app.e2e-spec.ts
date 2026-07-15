import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import type { ApiSuccess } from '@cabin/api-contract';
import { setupHttpContract } from './../src/common/http/setup-http-contract';

type HealthPayload = { status: string; database: string };

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupHttpContract(app);
    await app.init();
  });

  it('/health (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    const body = res.body as ApiSuccess<HealthPayload>;
    expect(body).toMatchObject({
      data: { status: 'ok', database: 'up' },
    });
    expect(body.meta?.requestId).toEqual(expect.any(String));
    expect(res.headers['x-request-id']).toBe(body.meta?.requestId);
  });

  afterEach(async () => {
    await app.close();
  });
});
