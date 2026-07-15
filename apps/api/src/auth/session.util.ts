import type { Request } from 'express';

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
