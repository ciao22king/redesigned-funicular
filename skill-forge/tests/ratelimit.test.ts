import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeDemoQuota,
  consumeMetricsQuota,
  consumeQuota,
  DAILY_LIMIT,
  dailyLimitFor,
  dayKey,
  DEMO_DAILY_LIMIT,
  FOUNDING_DAILY_LIMIT,
  isUnlimited,
  METRICS_DAILY_LIMIT,
  quotaMessage,
  rateLimitHeaders,
  readQuota,
  secondsUntilReset,
} from '../src/lib/ratelimit';

// The role lists come from the environment; set a founding tester so the
// per-role limit can be exercised without touching the real configuration.
process.env.FOUNDING_TESTERS = 'hxreborn,akkie76';

/** In-memory KV: the logic does not depend on Cloudflare to be tested. */
function fakeKV() {
  const map = new Map<string, string>();
  const writes: string[] = [];
  const ns = {
    get: async (key: string, type?: string) => {
      const raw = map.get(key);
      if (raw === undefined) return null;
      return type === 'json' ? JSON.parse(raw) : raw;
    },
    put: async (key: string, value: string) => {
      writes.push(key);
      map.set(key, value);
    },
  } as unknown as KVNamespace;
  return { ns, writes, map };
}

test('il proprietario e esente dal limite', () => {
  assert.equal(isUnlimited('ciao22king'), true);
});

test('l esenzione ignora maiuscole e minuscole', () => {
  assert.equal(isUnlimited('Ciao22King'), true);
});

test('un utente qualsiasi resta soggetto al limite', () => {
  assert.equal(isUnlimited('utente-qualsiasi'), false);
});

test('per l esente la quota e illimitata e non consuma KV', async () => {
  const { ns, writes } = fakeKV();
  const { allowed, quota } = await consumeQuota('ciao22king', ns);
  assert.equal(allowed, true);
  assert.equal(quota.unlimited, true);
  assert.equal(quota.remaining, Infinity);
  assert.deepEqual(writes, [], 'KV non deve essere scritto per un esente');
});

test('per l esente la lettura della quota non tocca KV', async () => {
  const { ns, writes } = fakeKV();
  const quota = await readQuota('ciao22king', ns);
  assert.equal(quota.unlimited, true);
  assert.deepEqual(writes, []);
});

test('l esente non si blocca mai, nemmeno oltre il limite', async () => {
  const { ns } = fakeKV();
  for (let i = 0; i < DAILY_LIMIT + 5; i++) {
    const { allowed } = await consumeQuota('ciao22king', ns);
    assert.equal(allowed, true, `bloccato al giro ${i}`);
  }
});

test('il founding tester ha un limite piu alto, non illimitato', async () => {
  assert.equal(isUnlimited('hxreborn'), false);
  assert.equal(dailyLimitFor('hxreborn'), FOUNDING_DAILY_LIMIT);
  assert.equal(dailyLimitFor('utente-qualsiasi'), DAILY_LIMIT);
});

test('il founding tester consuma fino a 5 al giorno e poi si blocca', async () => {
  const { ns } = fakeKV();
  for (let i = 0; i < FOUNDING_DAILY_LIMIT; i++) {
    const { allowed, quota } = await consumeQuota('hxreborn', ns);
    assert.equal(allowed, true);
    assert.equal(quota.unlimited, false);
    assert.equal(quota.limit, FOUNDING_DAILY_LIMIT);
  }
  const { allowed, quota } = await consumeQuota('hxreborn', ns);
  assert.equal(allowed, false);
  assert.equal(quota.remaining, 0);
  assert.equal(quota.limit, FOUNDING_DAILY_LIMIT);
});

test('la quota letta del founding tester riporta il limite maggiorato', async () => {
  const { ns } = fakeKV();
  await consumeQuota('hxreborn', ns);
  const quota = await readQuota('hxreborn', ns);
  assert.equal(quota.limit, FOUNDING_DAILY_LIMIT);
  assert.equal(quota.remaining, FOUNDING_DAILY_LIMIT - 1);
});

test('un utente normale consuma la quota e poi viene bloccato', async () => {
  const { ns } = fakeKV();
  for (let i = 0; i < DAILY_LIMIT; i++) {
    const { allowed, quota } = await consumeQuota('mario', ns);
    assert.equal(allowed, true);
    assert.equal(quota.unlimited, false);
    assert.equal(quota.used, i + 1);
  }
  const { allowed, quota } = await consumeQuota('mario', ns);
  assert.equal(allowed, false);
  assert.equal(quota.remaining, 0);
});

test('la quota letta rispecchia i consumi', async () => {
  const { ns } = fakeKV();
  await consumeQuota('mario', ns);
  const quota = await readQuota('mario', ns);
  assert.equal(quota.used, 1);
  assert.equal(quota.remaining, DAILY_LIMIT - 1);
  assert.equal(quota.limit, DAILY_LIMIT);
});

test('la chiave del giorno e la data UTC in corso', () => {
  const { key, resetsAt } = dayKey(new Date('2026-11-05T23:30:00Z'));
  assert.equal(key, '2026-11-05');
  assert.equal(resetsAt, '2026-11-06T00:00:00.000Z');
});

test('la demo consuma la quota per IP e poi blocca', async () => {
  const { ns } = fakeKV();
  for (let i = 0; i < DEMO_DAILY_LIMIT; i++) {
    const { allowed, quota } = await consumeDemoQuota('203.0.113.7', ns);
    assert.equal(allowed, true);
    assert.equal(quota.used, i + 1);
    assert.equal(quota.limit, DEMO_DAILY_LIMIT);
  }
  const { allowed, quota } = await consumeDemoQuota('203.0.113.7', ns);
  assert.equal(allowed, false);
  assert.equal(quota.remaining, 0);
});

test('la quota demo e separata per indirizzo', async () => {
  const { ns } = fakeKV();
  await consumeDemoQuota('203.0.113.7', ns);
  await consumeDemoQuota('203.0.113.7', ns);
  const blocked = await consumeDemoQuota('203.0.113.7', ns);
  assert.equal(blocked.allowed, false);

  const other = await consumeDemoQuota('198.51.100.9', ns);
  assert.equal(other.allowed, true, 'un altro IP non deve ereditare il blocco');
});

test('la chiave demo non collide con un login che sembra un IP', async () => {
  const { ns } = fakeKV();
  for (let i = 0; i < DAILY_LIMIT; i++) await consumeQuota('203.0.113.7', ns);
  const demo = await consumeDemoQuota('203.0.113.7', ns);
  assert.equal(demo.allowed, true, 'i due contatori non devono condividere la chiave');
});

test('gli header di limite espongono il residuo e la scadenza', () => {
  const quota = {
    used: 1,
    remaining: 2,
    limit: 3,
    resetsAt: '2030-01-02T00:00:00.000Z',
    unlimited: false,
  };
  const headers = rateLimitHeaders(quota);
  assert.equal(headers['X-RateLimit-Limit'], '3');
  assert.equal(headers['X-RateLimit-Remaining'], '2');
  assert.equal(headers['X-RateLimit-Reset'], '2030-01-02T00:00:00.000Z');
  assert.equal(headers['Retry-After'], undefined, 'con quota residua non c e Retry-After');
});

test('con quota esaurita compare Retry-After', () => {
  const quota = {
    used: 3,
    remaining: 0,
    limit: 3,
    resetsAt: '2030-01-02T00:00:00.000Z',
    unlimited: false,
  };
  const headers = rateLimitHeaders(quota);
  assert.ok(Number(headers['Retry-After']) > 0);
});

test('un utente illimitato non riceve header di limite', () => {
  const quota = { used: 0, remaining: Infinity, limit: Infinity, resetsAt: 'x', unlimited: true };
  assert.deepEqual(rateLimitHeaders(quota), {});
});

test('secondsUntilReset non e mai negativo', () => {
  const quota = { used: 3, remaining: 0, limit: 3, resetsAt: '2020-01-01T00:00:00.000Z', unlimited: false };
  assert.equal(secondsUntilReset(quota, Date.parse('2026-01-01T00:00:00Z')), 0);
});

test('il messaggio di quota dice quando si azzera e cosa fare', () => {
  const quota = { used: 3, remaining: 0, limit: 3, resetsAt: '2030-01-02T00:00:00.000Z', unlimited: false };
  const message = quotaMessage(quota);
  assert.match(message, /3 generations/);
  assert.match(message, /UTC/);
  assert.match(message, /Sign in with GitHub/);
});

test('il beacon metriche consuma la quota per IP e poi si blocca', async () => {
  const { ns, writes } = fakeKV();
  for (let i = 0; i < METRICS_DAILY_LIMIT; i++) {
    const { allowed } = await consumeMetricsQuota('203.0.113.7', ns);
    assert.equal(allowed, true, `bloccato al giro ${i}`);
  }
  const blocked = await consumeMetricsQuota('203.0.113.7', ns);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.quota.remaining, 0);
  // Un altro IP non e' toccato dal limite del primo.
  const other = await consumeMetricsQuota('203.0.113.8', ns);
  assert.equal(other.allowed, true);
  assert.ok(writes.every((k) => k.startsWith('metrics:')));
});

test('senza binding KV il beacon non viene bloccato', async () => {
  // In `next dev` non c'e' KV: il limite non si applica, come per le altre quote.
  const { allowed } = await consumeMetricsQuota('203.0.113.9', undefined as unknown as KVNamespace);
  assert.equal(allowed, true);
});
