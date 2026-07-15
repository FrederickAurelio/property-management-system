import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'cabin.sid';

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
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

/** Clear the session cookie after destroy (same options as login cookie). */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
}
