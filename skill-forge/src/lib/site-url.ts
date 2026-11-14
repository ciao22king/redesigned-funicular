import { headers } from 'next/headers';
import { legal } from './legal';

/**
 * Base URL for sitemap and robots: the origin that served the request, so the
 * listed addresses belong to the host Google downloads them from. If we listed
 * the canonical one while the site answers on another host, Google would
 * discard the sitemap ("URLs not allowed").
 *
 * `legal.siteUrl` stays the canonical one for the meta tags and acts as a
 * fallback outside an HTTP request, for example at build time.
 */
export async function siteBase(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto') ?? 'https';
      return `${proto}://${host}`;
    }
  } catch {
    // No request in flight: use the canonical one.
  }
  return legal.siteUrl;
}
