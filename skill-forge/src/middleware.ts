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

  // The admin area is noindex/nofollow twice over: the pages set the robots meta
  // tag, and this header covers anything that slips past the React metadata
  // (a streamed error page, an API response). Belt and suspenders for a private
  // area that must never reach an index.
  if (req.nextUrl.pathname === '/admin' || req.nextUrl.pathname.startsWith('/admin/')) {
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
