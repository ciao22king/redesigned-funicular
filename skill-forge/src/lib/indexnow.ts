import { getCloudflareContext } from '@opennextjs/cloudflare';
import { legal } from './legal';

/**
 * IndexNow key. The same value must be served as a text file at the site root
 * (`public/<key>.txt`), which is how the engines prove we own the host. Public
 * by design: it is not a credential, it is a claim of ownership.
 */
export const INDEXNOW_KEY = 'cd40f79ff1814c27ac068bd08a746c48';

/** Endpoint shared by Bing, Yandex, Seznam and Naver. */
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Builds the JSON body IndexNow expects for a set of URLs.
 *
 * The URLs must belong to `host`; the engines reject the whole batch otherwise,
 * so callers pass absolute URLs built from the canonical origin.
 */
export function buildPayload(urls: string[], host = legal.siteUrl): {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
} {
  return {
    host: new URL(host).host,
    key: INDEXNOW_KEY,
    keyLocation: `${host.replace(/\/$/, '')}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };
}

/**
 * Notifies the engines that the given URLs changed. Never throws: indexing is a
 * best-effort side effect of publishing, and a failing ping must not fail the
 * user's request. Returns whether the submission was accepted.
 */
export async function submitUrls(urls: string[], host = legal.siteUrl): Promise<boolean> {
  if (urls.length === 0) return false;
  const body = buildPayload(urls, host);

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    // 200 = accepted, 202 = accepted but key pending validation.
    return res.status === 200 || res.status === 202;
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget submission that survives the response.
 *
 * `waitUntil` keeps the Worker alive until the ping resolves; without it the
 * isolate could be torn down right after the reply and the fetch never leave.
 * Falls back to a detached promise outside Cloudflare (tests, `next dev`).
 */
export function submitUrlsInBackground(urls: string[], host = legal.siteUrl): void {
  const task = submitUrls(urls, host);
  void task.catch(() => {});
  void (async () => {
    try {
      const { ctx } = await getCloudflareContext({ async: true });
      ctx.waitUntil(task);
    } catch {
      // No Cloudflare context available: the detached promise is enough.
    }
  })();
}
