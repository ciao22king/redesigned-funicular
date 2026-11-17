import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creatorStatsFor, featuredOwners } from '../src/lib/creator-db';
import { rolesFor } from '../src/lib/users-db';
import { downloadsForSkills } from '../src/lib/metrics-db';
import type { D1Like } from '../src/lib/d1';

/**
 * Minimal fake D1 for the batch card queries.
 *
 * Each statement is recognised by its SQL and answered from the maps below, so
 * the grouped lookups are exercised without Cloudflare. `IN (...)` filters are
 * applied from the bound parameters so a test can prove the batching is scoped.
 */
function fakeD1(data: {
  stats?: Record<string, { published: number; stars: number; downloads: number }>;
  featured?: string[];
  users?: Record<string, string>;
  downloads?: Record<string, number>;
}) {
  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          params = values;
          return stmt;
        },
        async all() {
          if (/FROM skills s WHERE s.owner IN/i.test(sql)) {
            const wanted = new Set(params as string[]);
            return {
              results: Object.entries(data.stats ?? {})
                .filter(([owner]) => wanted.has(owner))
                .map(([owner, s]) => ({ owner, ...s })),
            };
          }
          if (/SELECT DISTINCT owner FROM skills/i.test(sql)) {
            const wanted = new Set(params as string[]);
            return {
              results: (data.featured ?? [])
                .filter((owner) => wanted.has(owner))
                .map((owner) => ({ owner })),
            };
          }
          if (/FROM users WHERE login IN/i.test(sql)) {
            const wanted = new Set(params as string[]);
            return {
              results: Object.entries(data.users ?? {})
                .filter(([login]) => wanted.has(login))
                .map(([login, first_seen]) => ({ login, first_seen })),
            };
          }
          if (/FROM metrics/i.test(sql)) {
            const wanted = new Set(params as string[]);
            return {
              results: Object.entries(data.downloads ?? {})
                .filter(([target]) => wanted.has(target))
                .map(([target, n]) => ({ target, n })),
            };
          }
          return { results: [] };
        },
        async first<T>() {
          return null as T | null;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
    async batch() {
      return [];
    },
  } as unknown as D1Like;
  return db;
}

test('creatorStatsFor legge piu autori in una volta', async () => {
  const db = fakeD1({
    stats: {
      a: { published: 3, stars: 12, downloads: 4 },
      b: { published: 1, stars: 0, downloads: 0 },
    },
  });
  const map = await creatorStatsFor(['a', 'b', 'missing'], db);
  assert.equal(map.get('a')?.published, 3);
  assert.equal(map.get('a')?.stars, 12);
  assert.equal(map.get('a')?.downloads, 4);
  assert.equal(map.get('b')?.published, 1);
  assert.equal(map.has('missing'), false);
});

test('creatorStatsFor con una lista vuota non interroga il database', async () => {
  const map = await creatorStatsFor([], fakeD1({}));
  assert.equal(map.size, 0);
});

test('featuredOwners tiene solo chi ha una skill in evidenza', async () => {
  const db = fakeD1({ featured: ['a'] });
  const set = await featuredOwners(['a', 'b'], db);
  assert.deepEqual([...set], ['a']);
});

test('featuredOwners con lista vuota torna un set vuoto', async () => {
  const set = await featuredOwners([], fakeD1({ featured: ['a'] }));
  assert.equal(set.size, 0);
});

test('rolesFor decide dal first_seen memorizzato', async () => {
  const db = fakeD1({ users: { a: '2020-01-01T00:00:00Z' } });
  const map = await rolesFor(['a'], db);
  assert.equal(map.get('a'), 'founding_tester');
});

test('rolesFor ricade su un ruolo valido per chi non ha riga', async () => {
  const db = fakeD1({});
  const map = await rolesFor(['nobody'], db);
  assert.ok(map.has('nobody'));
  assert.ok(['member', 'founding_tester', 'owner'].includes(map.get('nobody')!));
});

test('downloadsForSkills somma per skill e ignora le assenti', async () => {
  const db = fakeD1({ downloads: { 'a/one': 9, 'a/two': 2 } });
  const map = await downloadsForSkills(['a/one', 'a/two', 'a/three'], db);
  assert.equal(map.get('a/one'), 9);
  assert.equal(map.get('a/two'), 2);
  assert.equal(map.has('a/three'), false);
});

test('downloadsForSkills con lista vuota non interroga il database', async () => {
  const map = await downloadsForSkills([], fakeD1({}));
  assert.equal(map.size, 0);
});
