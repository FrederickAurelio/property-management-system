import type { CookieOptions, Request, Response } from 'express';

export const STAFF_SESSION_COOKIE_NAME = 'cabin.pms.sid';

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    // COOKIE_SECURE overrides NODE_ENV (HTTP VPS → false; HTTPS later → true)
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  return new Error(typeof err === 'string' ? err : 'Session error');
}

/** Promisify express-session regenerate (avoids `any` reject reasons). */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err: unknown) => {
      if (err) {
        reject(toError(err));
        return;
      }
      resolve();
    });
  });
}

/** Promisify express-session destroy. */
export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err: unknown) => {
      if (err) {
        reject(toError(err));
        return;
      }
      resolve();
    });
  });
}

/** Clear the staff session cookie after destroy (same options as login cookie). */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(STAFF_SESSION_COOKIE_NAME, sessionCookieOptions());
}
