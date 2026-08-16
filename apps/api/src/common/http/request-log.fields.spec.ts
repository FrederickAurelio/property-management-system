import {
  cabinAppFromRequest,
  cabinAudienceFromRequest,
  requestPathname,
  shouldSkipRequestLog,
  thrownErrorForRequestLog,
} from './request-log.fields';
import type { Request } from 'express';

function req(
  overrides: Partial<Request> & { headers?: Record<string, string> },
): Request {
  const headers = overrides.headers ?? {};
  return {
    header: (name: string) => headers[name.toLowerCase()] ?? headers[name],
    originalUrl: '/staff/reservations',
    url: '/staff/reservations',
    ...overrides,
  } as Request;
}

describe('request-log.fields', () => {
  it('reads x-cabin-app header', () => {
    expect(
      cabinAppFromRequest(req({ headers: { 'x-cabin-app': 'pms' } })),
    ).toBe('pms');
    expect(
      cabinAppFromRequest(req({ headers: { 'x-cabin-app': 'web' } })),
    ).toBe('web');
  });

  it('falls back to Origin ports', () => {
    expect(
      cabinAppFromRequest(
        req({ headers: { origin: 'http://localhost:5173' } }),
      ),
    ).toBe('pms');
    expect(
      cabinAppFromRequest(
        req({ headers: { origin: 'http://127.0.0.1:8080' } }),
      ),
    ).toBe('pms');
    expect(
      cabinAppFromRequest(
        req({ headers: { origin: 'http://localhost:5174' } }),
      ),
    ).toBe('web');
  });

  it('maps path prefix to audience', () => {
    expect(
      cabinAudienceFromRequest(req({ originalUrl: '/staff/auth/login' })),
    ).toBe('staff');
    expect(
      cabinAudienceFromRequest(
        req({ originalUrl: '/public/ical/units/x.ics' }),
      ),
    ).toBe('public');
    expect(cabinAudienceFromRequest(req({ originalUrl: '/health' }))).toBe(
      'infra',
    );
  });

  it('strips query strings from logged pathnames', () => {
    expect(requestPathname('/public/ical/units/u1.ics?token=secret')).toBe(
      '/public/ical/units/u1.ics',
    );
    expect(requestPathname('/staff/request-logs?page=2')).toBe(
      '/staff/request-logs',
    );
  });

  it('skips health, iCal pollers, and the diary GET', () => {
    expect(shouldSkipRequestLog('GET', '/health')).toBe(true);
    expect(
      shouldSkipRequestLog('GET', '/public/ical/units/u1.ics?token=secret'),
    ).toBe(true);
    expect(shouldSkipRequestLog('GET', '/staff/request-logs?page=1')).toBe(
      true,
    );
    expect(shouldSkipRequestLog('POST', '/staff/reservations')).toBe(false);
    expect(shouldSkipRequestLog('GET', '/staff/auth/session')).toBe(false);
  });

  it('formats the thrown Error for the request-log row', () => {
    expect(
      thrownErrorForRequestLog(
        new TypeError("Cannot read properties of undefined (reading 'id')"),
      ),
    ).toBe("TypeError: Cannot read properties of undefined (reading 'id')");
    expect(
      thrownErrorForRequestLog(
        new Error('Invalid `prisma.unit.findMany()` invocation\n\nDB boom'),
      ),
    ).toBe('Invalid `prisma.unit.findMany()` invocation');
  });
});
