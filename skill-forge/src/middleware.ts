import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * L'apex e' l'host canonico (vedi `legal.siteUrl`): `www` gli rimanda con un
 * 301 permanente, cosi' i motori indicizzano un solo indirizzo e non due copie.
 */
const CANONICAL_HOST = 'skillforge.eu.org';

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
