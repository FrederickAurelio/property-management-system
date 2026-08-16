import {
  isCredentialRoute,
  isHealthRoute,
  isPublicIcalRoute,
  isStaffLoginRoute,
  loginUsername,
} from './throttler.paths';
import type { Request } from 'express';

describe('throttler path helpers', () => {
  it('skips GET /health only', () => {
    expect(isHealthRoute('GET', '/health')).toBe(true);
    expect(isHealthRoute('get', '/health')).toBe(true);
    expect(isHealthRoute('POST', '/health')).toBe(false);
    expect(isHealthRoute('GET', '/staff/auth/session')).toBe(false);
  });

  it('treats public iCal export as its own path, not health', () => {
    expect(isPublicIcalRoute('GET', '/public/ical/units/u1.ics')).toBe(true);
    expect(isPublicIcalRoute('GET', '/public/ical/units/u1.ics?token=x')).toBe(
      true,
    );
    expect(isPublicIcalRoute('POST', '/public/ical/units/u1.ics')).toBe(false);
    expect(isPublicIcalRoute('GET', '/staff/ical/sync-all')).toBe(false);
  });

  it('treats credential writes as auth routes, not GET list', () => {
    expect(isCredentialRoute('POST', '/staff/auth/login')).toBe(true);
    expect(isCredentialRoute('PATCH', '/staff/auth/username')).toBe(true);
    expect(isCredentialRoute('PATCH', '/staff/auth/password')).toBe(true);
    expect(isCredentialRoute('POST', '/staff/admins')).toBe(true);
    expect(isCredentialRoute('PATCH', '/staff/admins/abc-uuid/role')).toBe(
      true,
    );
    expect(isCredentialRoute('PATCH', '/staff/admins/abc-uuid/active')).toBe(
      true,
    );
    expect(isCredentialRoute('GET', '/staff/admins')).toBe(false);
    expect(isCredentialRoute('POST', '/staff/auth/logout')).toBe(false);
    expect(isCredentialRoute('GET', '/staff/auth/session')).toBe(false);
  });

  it('limits the username bucket to login', () => {
    expect(isStaffLoginRoute('POST', '/staff/auth/login')).toBe(true);
    expect(isStaffLoginRoute('PATCH', '/staff/auth/password')).toBe(false);
  });

  it('reads a trimmed lowercase login username and skips empty', () => {
    expect(
      loginUsername({ body: { username: '  SuperAdmin ' } } as Request),
    ).toBe('superadmin');
    expect(loginUsername({ body: { username: '   ' } } as Request)).toBe(
      undefined,
    );
    expect(loginUsername({ body: {} } as Request)).toBeUndefined();
    expect(loginUsername({} as Request)).toBeUndefined();
  });
});
