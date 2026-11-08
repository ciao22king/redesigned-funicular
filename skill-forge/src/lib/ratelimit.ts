import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Daily generation limit per user, counted on Cloudflare KV.
 *
 * The key is the GitHub login, so the limit follows the person and not the IP
 * address: changing network or device does not reset the quota.
 *
 * The window is the UTC day, not a rolling 24 hours: the key contains the date
 * and expires at the end of the day, so the quota is full again at midnight UTC.
 */

export const DAILY_LIMIT = 3;

/**
 * Daily limit for the anonymous demo, counted per IP address. It is stricter
 * than the signed-in limit: the demo exists to show the output, not to be used
 * as a free generator.
 */
export const DEMO_DAILY_LIMIT = 2;

/**
 * Logins exempt from the limit (normally the owner only). Configured with
 * UNLIMITED_LOGINS, comma-separated ids, without touching the code.
 */
const UNLIMITED_LOGINS = new Set(
  (process.env.UNLIMITED_LOGINS ?? 'ciao22king')
    .split(',')
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean),
);

/** True if the login is exempt from the daily limit. */
export function isUnlimited(login: string): boolean {
  return UNLIMITED_LOGINS.has(login.toLowerCase());
}

export interface Quota {
  used: number;
  remaining: number;
  limit: number;
  /** ISO: when the counter expires and the quota is full again. */
  resetsAt: string;
  /** True when the user is not subject to the limit. */
  unlimited: boolean;
}

interface Counter {
  count: number;
}

/** Key and expiry of the current UTC day. */
export function dayKey(date = new Date()): { key: string; resetsAt: string } {
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const next = start + 24 * 60 * 60 * 1000;
  return {
    key: new Date(start).toISOString().slice(0, 10),
    resetsAt: new Date(next).toISOString(),
  };
}

async function store(): Promise<KVNamespace | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.RATE_LIMIT;
  } catch {
    // In `next dev` without the binding the limit is not applicable: we do not
    // block local development, but in production the binding is always there.
    return undefined;
  }
}

/** Reads the quota without consuming it. */
export async function readQuota(login: string, kv?: KVNamespace): Promise<Quota> {
  const { key, resetsAt } = dayKey();

  // An unlimited user has no counter: no need to read KV, and the UI does not
  // show a number that does not concern them.
  if (isUnlimited(login)) {
    return { used: 0, remaining: Infinity, limit: Infinity, resetsAt, unlimited: true };
  }

  const ns = kv ?? (await store());
  const used = ns ? Number((await ns.get<Counter>(`rl:${login}:${key}`, 'json'))?.count ?? 0) : 0;
  return {
    used,
    remaining: Math.max(0, DAILY_LIMIT - used),
    limit: DAILY_LIMIT,
    resetsAt,
    unlimited: false,
  };
}

/**
 * Consumes one generation if available.
 * Returns `allowed: false` with the quota unchanged when the limit is reached.
 */
export async function consumeQuota(
  login: string,
  kv?: KVNamespace,
): Promise<{ allowed: boolean; quota: Quota }> {
  const { key, resetsAt } = dayKey();

  // No counter to touch: the exemption neither consumes nor writes to KV.
  if (isUnlimited(login)) {
    return {
      allowed: true,
      quota: { used: 0, remaining: Infinity, limit: Infinity, resetsAt, unlimited: true },
    };
  }

  const ns = kv ?? (await store());

  if (!ns) {
    return {
      allowed: true,
      quota: { used: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT, resetsAt, unlimited: false },
    };
  }

  const storageKey = `rl:${login}:${key}`;
  const current = Number((await ns.get<Counter>(storageKey, 'json'))?.count ?? 0);

  if (current >= DAILY_LIMIT) {
    return {
      allowed: false,
      quota: { used: current, remaining: 0, limit: DAILY_LIMIT, resetsAt, unlimited: false },
    };
  }

  const count = current + 1;
  // 48-hour TTL: always covers the current UTC day with margin, so a counter
  // written shortly before midnight does not expire early.
  await ns.put(storageKey, JSON.stringify({ count }), { expirationTtl: 60 * 60 * 48 });

  return {
    allowed: true,
    quota: {
      used: count,
      remaining: Math.max(0, DAILY_LIMIT - count),
      limit: DAILY_LIMIT,
      resetsAt,
      unlimited: false,
    },
  };
}

/**
 * Daily limit for source fetching, counted per IP. Fetching a URL costs the
 * server a request to a third party, so it has its own, separate budget: a
 * visitor cannot spend their generation quota on fetching and then be blocked
 * from the feature they actually wanted.
 */
export const INGEST_DAILY_LIMIT = 20;

/**
 * Consumes one source fetch for an anonymous visitor, counted on the IP.
 * Namespaced like the demo counter, so the three budgets never share a slot.
 */
export async function consumeIngestQuota(
  ip: string,
  kv?: KVNamespace,
): Promise<{ allowed: boolean; quota: Quota }> {
  const { key, resetsAt } = dayKey();
  const empty: Quota = {
    used: 0,
    remaining: INGEST_DAILY_LIMIT,
    limit: INGEST_DAILY_LIMIT,
    resetsAt,
    unlimited: false,
  };

  const ns = kv ?? (await store());
  if (!ns) return { allowed: true, quota: empty };

  const storageKey = `ingest:${ip}:${key}`;
  const current = Number((await ns.get<Counter>(storageKey, 'json'))?.count ?? 0);

  if (current >= INGEST_DAILY_LIMIT) {
    return { allowed: false, quota: { ...empty, used: current, remaining: 0 } };
  }

  const count = current + 1;
  await ns.put(storageKey, JSON.stringify({ count }), { expirationTtl: 60 * 60 * 48 });

  return {
    allowed: true,
    quota: { ...empty, used: count, remaining: Math.max(0, INGEST_DAILY_LIMIT - count) },
  };
}

/**
 * Consumes one demo generation for an anonymous visitor, counted on the IP.
 *
 * The key is namespaced (`demo:`) so a visitor cannot collide with a GitHub login
 * that happens to look like an address, and so the demo counter and the signed-in
 * counter never share a slot.
 */
export async function consumeDemoQuota(
  ip: string,
  kv?: KVNamespace,
): Promise<{ allowed: boolean; quota: Quota }> {
  const { key, resetsAt } = dayKey();
  const empty: Quota = {
    used: 0,
    remaining: DEMO_DAILY_LIMIT,
    limit: DEMO_DAILY_LIMIT,
    resetsAt,
    unlimited: false,
  };

  const ns = kv ?? (await store());
  if (!ns) return { allowed: true, quota: empty };

  const storageKey = `demo:${ip}:${key}`;
  const current = Number((await ns.get<Counter>(storageKey, 'json'))?.count ?? 0);

  if (current >= DEMO_DAILY_LIMIT) {
    return {
      allowed: false,
      quota: { ...empty, used: current, remaining: 0 },
    };
  }

  const count = current + 1;
  await ns.put(storageKey, JSON.stringify({ count }), { expirationTtl: 60 * 60 * 48 });

  return {
    allowed: true,
    quota: { ...empty, used: count, remaining: Math.max(0, DEMO_DAILY_LIMIT - count) },
  };
}

/**
 * Rate-limit headers for a response, so the limit is transparent instead of a
 * surprise. A client can read exactly how much is left and when it comes back,
 * which is also what the UI shows. An unlimited user gets no headers, because a
 * limit that does not apply to them would only be noise.
 *
 * The names follow the common `X-RateLimit-*` convention and `Retry-After` is
 * the standard header for the 429 case.
 */
export function rateLimitHeaders(quota: Quota): Record<string, string> {
  if (quota.unlimited) return {};
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(quota.limit),
    'X-RateLimit-Remaining': String(quota.remaining),
    'X-RateLimit-Reset': quota.resetsAt,
  };
  if (quota.remaining <= 0) {
    headers['Retry-After'] = String(secondsUntilReset(quota));
  }
  return headers;
}

/** Seconds until the quota is full again, never negative. */
export function secondsUntilReset(quota: Quota, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(quota.resetsAt) - now) / 1000));
}

/**
 * A useful, actionable message for a spent quota.
 *
 * It says what happened, when it resets (in both UTC and the reader's clock),
 * and what to do next, instead of a bare "too many requests".
 */
export function quotaMessage(quota: Quota, what = 'generations'): string {
  const reset = new Date(quota.resetsAt);
  const utc = reset.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
  const local = reset.toLocaleString(undefined, { hour12: false });
  return `You have used all ${quota.limit} ${what} for today. The limit resets at ${utc} UTC (${local} your time). Sign in with GitHub for a larger daily allowance, or come back after the reset.`;
}

