import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { legal } from '@/lib/legal';

/**
 * The apex is the canonical host (see `legal.siteUrl`): `www` redirects to it
 * with a permanent 301, so engines index a single address and not two copies.
 */
const CANONICAL_HOST = new URL(legal.siteUrl).host;

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').split(':')[0];

  if (host === `www.${CANONICAL_HOST}`) {
    const target = new URL(
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
      `https://${CANONICAL_HOST}`,
    );
    return NextResponse.redirect(target, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
