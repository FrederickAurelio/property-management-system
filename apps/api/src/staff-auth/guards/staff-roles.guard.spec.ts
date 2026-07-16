import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@cabin/api-contract';
import { STAFF_ROLES_KEY } from '../decorators/staff-roles.decorator';
import { StaffRolesGuard } from './staff-roles.guard';
import type { RequestWithAdmin } from './staff-session-auth.guard';

function mockContext(adminRole?: AdminRole) {
  const request = {
    admin: adminRole
      ? {
          id: 'a1',
          username: 'u',
          role: adminRole,
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }
      : undefined,
  } as RequestWithAdmin;

  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

describe('StaffRolesGuard', () => {
  let guard: StaffRolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new StaffRolesGuard(reflector);
  });

  it('allows when no roles metadata is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext(AdminRole.FRONT_DESK) as never)).toBe(
      true,
    );
  });

  it('allows ADMIN and SUPER_ADMIN when min is ADMIN', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.ADMIN]);

    expect(guard.canActivate(mockContext(AdminRole.ADMIN) as never)).toBe(true);
    expect(guard.canActivate(mockContext(AdminRole.SUPER_ADMIN) as never)).toBe(
      true,
    );
  });

  it('rejects FRONT_DESK when min is ADMIN', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.ADMIN]);

    expect(() =>
      guard.canActivate(mockContext(AdminRole.FRONT_DESK) as never),
    ).toThrow(ForbiddenException);
  });

  it('allows all roles when min is FRONT_DESK', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.FRONT_DESK]);

    expect(guard.canActivate(mockContext(AdminRole.FRONT_DESK) as never)).toBe(
      true,
    );
    expect(guard.canActivate(mockContext(AdminRole.ADMIN) as never)).toBe(true);
    expect(guard.canActivate(mockContext(AdminRole.SUPER_ADMIN) as never)).toBe(
      true,
    );
  });

  it('allows only SUPER_ADMIN when min is SUPER_ADMIN', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.SUPER_ADMIN]);

    expect(guard.canActivate(mockContext(AdminRole.SUPER_ADMIN) as never)).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(mockContext(AdminRole.ADMIN) as never),
    ).toThrow(ForbiddenException);
  });

  it('uses the lowest listed role as the bar', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.ADMIN, AdminRole.SUPER_ADMIN]);

    expect(guard.canActivate(mockContext(AdminRole.ADMIN) as never)).toBe(true);
    expect(() =>
      guard.canActivate(mockContext(AdminRole.FRONT_DESK) as never),
    ).toThrow(ForbiddenException);
  });

  it('rejects when request has no admin role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.FRONT_DESK]);

    expect(() => guard.canActivate(mockContext() as never)).toThrow(
      ForbiddenException,
    );
  });

  it('reads roles via STAFF_ROLES_KEY', () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.ADMIN]);

    guard.canActivate(mockContext(AdminRole.ADMIN) as never);

    expect(spy).toHaveBeenCalledWith(
      STAFF_ROLES_KEY,
      expect.arrayContaining([expect.anything(), expect.anything()]),
    );
  });
});
