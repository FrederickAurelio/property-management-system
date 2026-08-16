import { mapLokiEntry } from './request-logs.mapper';

const SAMPLE_NS = '1755312000000000000';

function pinoLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    level: 30,
    req: { id: 'abc', method: 'POST', url: '/staff/reservations' },
    res: { statusCode: 409 },
    responseTime: 12,
    requestId: 'abc-123',
    app: 'pms',
    audience: 'staff',
    actor: 'rina',
    errorCode: 'CONFLICT',
    errorMessage: 'dates overlap on unit A-12',
    msg: 'POST /staff/reservations 409',
    ...overrides,
  });
}

describe('mapLokiEntry', () => {
  it('maps a pino HTTP line to StaffRequestLogItem', () => {
    const item = mapLokiEntry(SAMPLE_NS, pinoLine());
    expect(item).toEqual({
      time: new Date(Number(BigInt(SAMPLE_NS) / 1_000_000n)).toISOString(),
      actor: 'rina',
      app: 'pms',
      audience: 'staff',
      method: 'POST',
      path: '/staff/reservations',
      status: 409,
      durationMs: 12,
      requestId: 'abc-123',
      errorCode: 'CONFLICT',
      errorMessage: 'dates overlap on unit A-12',
    });
  });

  it('drops non-JSON and Nest boot noise', () => {
    expect(mapLokiEntry(SAMPLE_NS, 'not json')).toBeNull();
    expect(
      mapLokiEntry(
        SAMPLE_NS,
        JSON.stringify({ msg: 'Nest application successfully started' }),
      ),
    ).toBeNull();
  });

  it('defaults optional actor/app and omits error fields on 200', () => {
    const item = mapLokiEntry(
      SAMPLE_NS,
      pinoLine({
        res: { statusCode: 200 },
        actor: undefined,
        app: 'unknown',
        errorCode: undefined,
        errorMessage: undefined,
      }),
    );
    expect(item?.status).toBe(200);
    expect(item?.actor).toBe('-');
    expect(item?.app).toBe('-');
    expect(item?.errorCode).toBeUndefined();
    expect(item?.errorMessage).toBeUndefined();
  });

  it('unwraps docker json-file lines', () => {
    const wrapped = JSON.stringify({
      log: `${pinoLine()}\n`,
      stream: 'stdout',
      time: '2026-08-16T04:00:00.000Z',
    });
    const item = mapLokiEntry(SAMPLE_NS, wrapped);
    expect(item?.path).toBe('/staff/reservations');
    expect(item?.status).toBe(409);
  });

  it('strips query strings from logged urls', () => {
    const item = mapLokiEntry(
      SAMPLE_NS,
      pinoLine({
        req: {
          method: 'GET',
          url: '/public/ical/units/u1.ics?token=secret',
        },
        res: { statusCode: 200 },
      }),
    );
    expect(item?.path).toBe('/public/ical/units/u1.ics');
  });

  it('prefers the top-level path custom prop', () => {
    const item = mapLokiEntry(
      SAMPLE_NS,
      pinoLine({
        path: '/staff/reservations',
        req: {
          method: 'POST',
          url: '/staff/other?debug=1',
        },
      }),
    );
    expect(item?.path).toBe('/staff/reservations');
  });
});
