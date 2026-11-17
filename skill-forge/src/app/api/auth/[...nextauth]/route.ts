import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { consumeLogin } from '@/lib/ratelimit';

const handler = NextAuth(authOptions);

/** Client address, for the sign-in limiter. Cloudflare sets `cf-connecting-ip`. */
function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  );
}

/**
 * True only for the POST calls that start or complete a login.
 *
 * A GET (reading the session, the providers, the CSRF token) is not an attempt
 * and must not consume the budget, or a normal page load would count against the
 * person. The limit is per address and generous for a human, so a scripted loop
 * is what it stops.
 */
function isLoginAttempt(req: NextRequest): boolean {
  if (req.method !== 'POST') return false;
  const path = new URL(req.url).pathname;
  return /\/api\/auth\/(signin|callback)\//.test(path);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  if (isLoginAttempt(req)) {
    const { allowed } = await consumeLogin(clientIp(req));
    if (!allowed) {
      return new Response('Too many sign-in attempts. Please wait a few minutes and try again.', {
        status: 429,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }
  return handler(req, ctx);
}