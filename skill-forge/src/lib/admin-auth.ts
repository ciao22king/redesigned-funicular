import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions, getServerAuth } from './auth';
import { isAdmin } from './admin';
import { recordAudit } from './audit-db';
import { consumeAdminAction, consumeAdminLogin, windowHeaders, type WindowQuota } from './ratelimit';
import type { AuditAction } from './audit';

/**
 * Server-side guard for the admin area.
 *
 * Access is the closed login list in `admin.ts`, checked against the identity
 * the session or the CLI token already proved — never against a value from the
 * request body. Every action also consumes the operator's action budget and
 * writes an audit line, so the panel is rate-limited and accountable.
 */

/** Client address, for the audit line and the sign-in limiter. */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  );
}

export interface AdminIdentity {
  login: string;
}

/**
 * The admin login behind the request, or null.
 *
 * Works for both a browser session (the NextAuth cookie) and the CLI (a bearer
 * token), because it goes through the same `getServerAuth`. A signed-in but
 * non-admin user is treated as not an admin.
 */
export async function adminIdentity(req: NextRequest): Promise<AdminIdentity | null> {
  const { login } = await getServerAuth(req);
  if (isAdmin(login)) return { login: login as string };

  // A plain browser navigation has no bearer token; fall back to the session.
  try {
    const session = await getServerSession(authOptions);
    const sessionLogin = session?.user?.login;
    if (isAdmin(sessionLogin)) return { login: sessionLogin as string };
  } catch {
    // No session available.
  }
  return null;
}

export interface AdminGuardOk {
  ok: true;
  login: string;
}
export interface AdminGuardFail {
  ok: false;
  status: number;
  error: string;
  headers?: Record<string, string>;
}

/**
 * Guard for an admin API route.
 *
 * Checks identity, then the action budget. On failure the caller returns the
 * given status and message; the message never says whether the login exists or
 * why access was refused beyond "not allowed", so the endpoint is not an oracle.
 *
 * `identity` may be passed in when the caller has already resolved it (to
 * reject an anonymous request before parsing the body), so the session is not
 * decoded twice.
 */
export async function guardAdminAction(
  req: NextRequest,
  action: AuditAction,
  target: string,
  identity?: AdminIdentity | null,
): Promise<AdminGuardOk | AdminGuardFail> {
  const who = identity === undefined ? await adminIdentity(req) : identity;
  if (!who) {
    return { ok: false, status: 403, error: 'Not allowed.' };
  }

  const quota: WindowQuota = await consumeAdminAction(who.login);
  if (!quota.allowed) {
    return {
      ok: false,
      status: 429,
      error: 'Too many admin actions in a short time. Please wait and try again.',
      headers: windowHeaders(quota),
    };
  }

  await recordAudit({
    actor: who.login,
    action,
    target,
    ip: clientIp(req),
  });

  return { ok: true, login: who.login };
}

/** Rate-limits a sign-in attempt by address. Returns the headers to send back. */
export async function limitAdminLogin(ip: string): Promise<{
  allowed: boolean;
  headers: Record<string, string>;
}> {
  const quota = await consumeAdminLogin(ip);
  return { allowed: quota.allowed, headers: windowHeaders(quota) };
}
