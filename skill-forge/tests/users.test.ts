import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLogin, userCountLabel } from '../src/lib/users';
import { countUsers, publicUserCount, recordUser } from '../src/lib/users-db';
import type { D1Like } from '../src/lib/d1';

/** Minimal fake D1 that remembers rows in a Map, enough for the users queries. */
function fakeD1() {
  const users = new Map<string, { first_seen: string; last_seen: string }>();
  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          params = values;
          return stmt;
        },
        async all() {
          return { results: [...users.entries()].map(([login, v]) => ({ login, ...v })) };
        },
        async first<T>() {
          if (/COUNT\(\*\)/i.test(sql)) return { n: users.size } as T;
          const login = params[0] as string;
          const v = users.get(login);
          return (v ? { login, ...v } : null) as T | null;
        },
        async run() {
          if (/INSERT INTO users/i.test(sql)) {
            const [login, first, last] = params as [string, string, string];
            const existing = users.get(login);
            // Mirrors ON CONFLICT: first_seen is kept, last_seen moves.
            users.set(login, {
              first_seen: existing?.first_seen ?? first,
              last_seen: last,
            });
          }
          return {};
        },
      };
      return stmt;
    },
    async batch() {
      return [];
    },
  } as unknown as D1Like;
  return { db, users };
}

test('userCountLabel pluralizza al singolare e al plurale', () => {
  assert.equal(userCountLabel(0), '0 users');
  assert.equal(userCountLabel(1), '1 user');
  assert.equal(userCountLabel(2), '2 users');
  assert.equal(userCountLabel(1234), '1234 users');
});

test('userCountLabel tratta valori non validi come zero', () => {
  assert.equal(userCountLabel(-5), '0 users');
  assert.equal(userCountLabel(Number.NaN), '0 users');
  assert.equal(userCountLabel(Number.POSITIVE_INFINITY), '0 users');
  assert.equal(userCountLabel(3.9), '3 users');
});

test('isLogin accetta un login GitHub valido e rifiuta il resto', () => {
  assert.equal(isLogin('ciao22king'), true);
  assert.equal(isLogin('a-b-c'), true);
  assert.equal(isLogin('bad--name'), false);
  assert.equal(isLogin('-start'), false);
  assert.equal(isLogin(''), false);
  assert.equal(isLogin('x'.repeat(40)), false);
  assert.equal(isLogin(42), false);
  assert.equal(isLogin(undefined), false);
});

test('recordUser conta utenti distinti, non accessi', async () => {
  const { db } = fakeD1();
  await recordUser('alice', db);
  await recordUser('bob', db);
  await recordUser('alice', db);
  assert.equal(await countUsers(db), 2);
});

test('recordUser conserva first_seen e sposta last_seen', async () => {
  const { db, users } = fakeD1();
  await recordUser('alice', db, '2026-11-01T00:00:00.000Z');
  await recordUser('alice', db, '2026-11-07T00:00:00.000Z');
  assert.equal(users.get('alice')?.first_seen, '2026-11-01T00:00:00.000Z');
  assert.equal(users.get('alice')?.last_seen, '2026-11-07T00:00:00.000Z');
});

test('recordUser ignora un login non valido senza toccare il database', async () => {
  const { db, users } = fakeD1();
  await recordUser('bad--login', db);
  assert.equal(users.size, 0);
});

test('countUsers parte da zero', async () => {
  const { db } = fakeD1();
  assert.equal(await countUsers(db), 0);
});

test('publicUserCount nasconde lo zero', async () => {
  const { db } = fakeD1();
  assert.equal(await publicUserCount(db), undefined);
  await recordUser('alice', db);
  assert.equal(await publicUserCount(db), 1);
});

test('publicUserCount non lancia se il database manca', async () => {
  // No injected database and no binding: must degrade, not throw.
  const previous = process.env.NEXT_PHASE;
  try {
    delete process.env.NEXT_PHASE;
    const result = await publicUserCount();
    assert.ok(result === undefined || typeof result === 'number');
  } finally {
    if (previous !== undefined) process.env.NEXT_PHASE = previous;
  }
});
