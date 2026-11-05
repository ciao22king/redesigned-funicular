import { headers } from 'next/headers';
import { legal } from './legal';

/**
 * Base URL per sitemap e robots: l'origine che ha servito la richiesta, cosi'
 * gli indirizzi elencati appartengono all'host da cui Google li scarica. Se
 * elencassimo il canone mentre il sito risponde su un altro host, Google
 * scarterebbe la sitemap ("URL non consentiti").
 *
 * `legal.siteUrl` resta il canone per i meta tag e fa da ripiego fuori da una
 * richiesta HTTP, per esempio a build time.
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
    // Nessuna richiesta in corso: si usa il canone.
  }
  return legal.siteUrl;
}
