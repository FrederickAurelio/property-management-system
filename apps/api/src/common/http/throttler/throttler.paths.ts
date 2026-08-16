import type { Request } from 'express';
import { requestPathname } from '../request-log.fields.js';

const CREDENTIAL_ADMIN_MUTATION = /^\/staff\/admins\/[^/]+\/(role|active)$/;

export function routePath(req: Request): string {
  return requestPathname(req.path || req.originalUrl || req.url);
}

export function isHealthRoute(method: string, path: string): boolean {
  return method.toUpperCase() === 'GET' && path === '/health';
}

export function isHealthRequest(req: Request): boolean {
  return isHealthRoute(req.method, routePath(req));
}

export function isPublicIcalRoute(method: string, path: string): boolean {
  return method.toUpperCase() === 'GET' && path.startsWith('/public/ical/');
}

export function isPublicIcalRequest(req: Request): boolean {
  return isPublicIcalRoute(req.method, routePath(req));
}

export function isStaffLoginRoute(method: string, path: string): boolean {
  return method.toUpperCase() === 'POST' && path === '/staff/auth/login';
}

export function isCredentialRoute(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  if (isStaffLoginRoute(verb, path)) {
    return true;
  }
  if (
    verb === 'PATCH' &&
    (path === '/staff/auth/username' || path === '/staff/auth/password')
  ) {
    return true;
  }
  if (verb === 'POST' && path === '/staff/admins') {
    return true;
  }
  return verb === 'PATCH' && CREDENTIAL_ADMIN_MUTATION.test(path);
}

export function isCredentialRequest(req: Request): boolean {
  return isCredentialRoute(req.method, routePath(req));
}

export function isStaffLoginRequest(req: Request): boolean {
  return isStaffLoginRoute(req.method, routePath(req));
}

export function clientIp(req: Request): string {
  const forwarded = req.ips[0];
  if (forwarded) {
    return forwarded;
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function defaultTracker(req: Request): string {
  const adminId = req.session?.adminId;
  if (typeof adminId === 'string' && adminId.length > 0) {
    return `admin:${adminId}`;
  }
  return clientIp(req);
}

export function loginUsername(req: Request): string | undefined {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || !('username' in body)) {
    return undefined;
  }
  const raw: unknown = body.username;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const username = raw.trim().toLowerCase();
  return username.length > 0 ? username : undefined;
}
