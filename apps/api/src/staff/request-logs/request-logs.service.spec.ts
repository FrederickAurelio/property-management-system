import {
  REQUEST_LOGS_LOOKBACK_MS,
  REQUEST_LOGS_QUERY_CAP,
} from '@cabin/api-contract';
import { RequestLogsService } from './request-logs.service';
import type { LokiStreamValue } from './loki-query.client';

function pinoLine(status: number, requestId: string): string {
  return JSON.stringify({
    req: { method: 'GET', url: '/staff/auth/session' },
    res: { statusCode: status },
    responseTime: 4,
    requestId,
    app: 'pms',
    audience: 'staff',
    actor: 'rina',
  });
}

function nsForIndex(i: number): string {
  return (
    BigInt(1_755_312_000_000_000_000) -
    BigInt(i) * 1_000_000n
  ).toString();
}

describe('RequestLogsService', () => {
  it('slices newest-first pages and flags truncated windows', async () => {
    const raw: LokiStreamValue[] = Array.from(
      { length: REQUEST_LOGS_QUERY_CAP },
      (_, i) => [nsForIndex(i), pinoLine(200, `id-${i}`)],
    );
    const loki = {
      queryRange: jest.fn().mockResolvedValue(raw),
    };
    const service = new RequestLogsService(loki);

    const page1 = await service.list({ page: 1, pageSize: 20 });
    expect(page1.truncated).toBe(true);
    expect(page1.pageInfo.total).toBe(REQUEST_LOGS_QUERY_CAP);
    expect(page1.items).toHaveLength(20);
    expect(page1.items[0]?.requestId).toBe('id-0');

    const page2 = await service.list({ page: 2, pageSize: 20 });
    expect(page2.items[0]?.requestId).toBe('id-20');
  });

  it('clamps a 30-day window instead of rejecting clock skew', async () => {
    const loki = {
      queryRange: jest.fn().mockResolvedValue([]),
    };
    const service = new RequestLogsService(loki);
    const now = Date.now();
    await expect(
      service.list({
        page: 1,
        pageSize: 20,
        from: new Date(now - REQUEST_LOGS_LOOKBACK_MS - 5_000).toISOString(),
        to: new Date(now).toISOString(),
      }),
    ).resolves.toMatchObject({ items: [] });
    expect(loki.queryRange).toHaveBeenCalled();
  });

  it('keeps errorsOnly after mapping when Loki returns mixed statuses', async () => {
    const raw: LokiStreamValue[] = [
      [nsForIndex(0), pinoLine(200, 'ok')],
      [nsForIndex(1), pinoLine(409, 'err')],
    ];
    const loki = {
      queryRange: jest.fn().mockResolvedValue(raw),
    };
    const service = new RequestLogsService(loki);
    const page = await service.list({
      page: 1,
      pageSize: 20,
      errorsOnly: true,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.requestId).toBe('err');
    expect(page.pageInfo.total).toBe(1);
  });

  it('does not treat an error message as a path match', async () => {
    const otherRoute = JSON.stringify({
      req: { method: 'POST', url: '/staff/auth/login' },
      res: { statusCode: 409 },
      requestId: 'other',
      path: '/staff/auth/login',
      errorMessage: 'see /staff/reservations',
    });
    const loki = {
      queryRange: jest.fn().mockResolvedValue([[nsForIndex(0), otherRoute]]),
    };
    const service = new RequestLogsService(loki);
    const page = await service.list({
      page: 1,
      pageSize: 20,
      path: '/staff/reservations',
    });
    expect(page.items).toHaveLength(0);
  });
});
