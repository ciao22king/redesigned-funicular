import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeQuota,
  DAILY_LIMIT,
  dayKey,
  isUnlimited,
  readQuota,
} from '../src/lib/ratelimit';

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
