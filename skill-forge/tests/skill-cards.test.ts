import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardBadges, MAX_CARD_BADGES, skillCardsFor } from '../src/lib/skill-cards';
import type { PublicProfileBadge } from '../src/lib/profile';
import type { SkillSummary } from '../src/lib/marketplace';
import type { D1Like } from '../src/lib/d1';

function badge(id: PublicProfileBadge['id']): PublicProfileBadge {
  return { id, label: id, description: '', tone: 'quiet' };
}

// ---------------------------------------------------------------------------
// cardBadges
// ---------------------------------------------------------------------------

test('senza badge il risultato e vuoto', () => {
  assert.deepEqual(cardBadges([]), []);
});

test('i badge si limitano a tre per default', () => {
  const all = [badge('founding'), badge('verified'), badge('top-author'), badge('featured')];
  assert.equal(cardBadges(all).length, MAX_CARD_BADGES);
});

test('quando si deve tagliare, resta il badge piu significativo', () => {
  const all = [badge('founding'), badge('verified'), badge('top-author'), badge('featured')];
  const kept = cardBadges(all).map((b) => b.id);
  // Founding is the quietest, so it is the one dropped.
  assert.deepEqual(kept, ['featured', 'top-author', 'verified']);
});

test('i badge si ordinano per rilevanza, non per come arrivano', () => {
  const kept = cardBadges([badge('verified'), badge('featured')]).map((b) => b.id);
  assert.deepEqual(kept, ['featured', 'verified']);
});

test('un limite esplicito viene rispettato', () => {
  const all = [badge('founding'), badge('verified'), badge('top-author')];
  assert.equal(cardBadges(all, 1).length, 1);
  assert.equal(cardBadges(all, 0).length, 0);
});

test('cardBadges non muta l array di partenza', () => {
  const all = [badge('founding'), badge('featured')];
  const snapshot = [...all];
  cardBadges(all);
  assert.deepEqual(all, snapshot);
});

// ---------------------------------------------------------------------------
// skillCardsFor
// ---------------------------------------------------------------------------

function summary(over: Partial<SkillSummary>): SkillSummary {
  return {
    id: 'a/one',
    owner: 'a',
    name: 'one',
    description: 'd',
    tags: ['git'],
    stars: 0,
    category: 'code',
    status: 'published',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-02T00:00:00Z',
    ...over,
  };
}

/**
 * Minimal fake D1 for the card batch queries.
 *
 * It answers the five statements `skill-cards` issues, each keyed off the SQL it
 * recognises, so the batch path is exercised without Cloudflare.
 */
function fakeD1(data: {
  profiles?: Record<string, Record<string, unknown>>;
  stats?: Record<string, { published: number; stars: number; downloads: number }>;
  featured?: string[];
  users?: Record<string, string>;
  downloads?: Record<string, number>;
}) {
  const db = {
    prepare(sql: string) {
      const stmt = {
        bind(..._values: unknown[]) {
          return stmt;
        },
        async all() {
          if (/FROM profiles WHERE login IN/i.test(sql)) {
            return { results: Object.values(data.profiles ?? {}) };
          }
          if (/FROM skills s WHERE s.owner IN/i.test(sql)) {
            return {
              results: Object.entries(data.stats ?? {}).map(([owner, s]) => ({ owner, ...s })),
            };
          }
          if (/SELECT DISTINCT owner FROM skills/i.test(sql)) {
            return { results: (data.featured ?? []).map((owner) => ({ owner })) };
          }
          if (/FROM users WHERE login IN/i.test(sql)) {
            return {
              results: Object.entries(data.users ?? {}).map(([login, first_seen]) => ({
                login,
                first_seen,
              })),
            };
          }
          if (/FROM metrics/i.test(sql)) {
            return {
              results: Object.entries(data.downloads ?? {}).map(([target, n]) => ({ target, n })),
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

test('una lista vuota non interroga il database', async () => {
  const cards = await skillCardsFor([], fakeD1({}));
  assert.deepEqual(cards, []);
});

test('la card porta autore, avatar, download e categoria', async () => {
  const db = fakeD1({
    profiles: { a: { login: 'a', display_name: 'Drix', avatar_url: 'https://x/a.png' } },
    stats: { a: { published: 3, stars: 12, downloads: 0 } },
    downloads: { 'a/one': 7 },
  });
  const [card] = await skillCardsFor([summary({})], db);
  assert.equal(card.authorName, 'Drix');
  assert.equal(card.avatar, 'https://x/a.png');
  assert.equal(card.downloads, 7);
  assert.equal(card.category, 'code');
  assert.equal(card.stars, 0);
});

test('senza profilo si ricade sul login e sull avatar GitHub', async () => {
  const db = fakeD1({});
  const [card] = await skillCardsFor([summary({ owner: 'bob' })], db);
  assert.equal(card.authorName, 'bob');
  assert.equal(card.avatar, 'https://avatars.githubusercontent.com/bob');
  assert.equal(card.downloads, 0);
});

test('un autore in evidenza prende il badge featured', async () => {
  const db = fakeD1({ featured: ['a'] });
  const [card] = await skillCardsFor([summary({})], db);
  // Featured is the strongest, so it leads whatever else the author earned.
  assert.equal(card.badges[0]?.id, 'featured');
});

test('un founding tester prende il badge founding', async () => {
  const db = fakeD1({
    users: { a: '2020-01-01T00:00:00Z' },
    stats: { a: { published: 1, stars: 0, downloads: 0 } },
  });
  const [card] = await skillCardsFor([summary({})], db);
  assert.ok(card.badges.some((b) => b.id === 'founding'));
});

test('piu skill dello stesso autore condividono una sola riga di statistiche', async () => {
  const db = fakeD1({
    stats: { a: { published: 2, stars: 4, downloads: 0 } },
  });
  const cards = await skillCardsFor([summary({ id: 'a/one' }), summary({ id: 'a/two' })], db);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].authorName, 'a');
  assert.equal(cards[1].authorName, 'a');
});
