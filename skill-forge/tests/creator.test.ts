import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allBadges,
  badgeFor,
  CREATOR_TIERS,
  FEATURED_MIN_STARS,
  isFeatured,
  nextTier,
  pickFeatured,
} from '../src/lib/creator';

test('senza pubblicazioni il badge e newcomer', () => {
  const badge = badgeFor({ published: 0, stars: 0, downloads: 0 });
  assert.equal(badge.id, 'newcomer');
});

test('una pubblicazione da contributor', () => {
  const badge = badgeFor({ published: 1, stars: 0, downloads: 0 });
  assert.equal(badge.id, 'contributor');
});

test('abbastanza lavoro e stelle da maker', () => {
  const badge = badgeFor({
    published: CREATOR_TIERS.maker.published,
    stars: CREATOR_TIERS.maker.stars,
    downloads: 0,
  });
  assert.equal(badge.id, 'maker');
});

test('essere in evidenza vince sugli altri badge', () => {
  const badge = badgeFor({ published: 10, stars: 100, downloads: 0 }, true);
  assert.equal(badge.id, 'featured');
});

test('la scala dei badge e in ordine crescente', () => {
  const ids = allBadges().map((b) => b.id);
  assert.deepEqual(ids, ['newcomer', 'contributor', 'maker', 'featured']);
});

test('il prossimo livello dice cosa manca', () => {
  const next = nextTier({ published: 1, stars: 2, downloads: 0 });
  assert.equal(next?.badge.id, 'maker');
  assert.ok(next?.missing.includes('skill'));
  assert.ok(next?.missing.includes('star'));
});

test('a livello maker non c e un prossimo livello', () => {
  const next = nextTier({
    published: CREATOR_TIERS.maker.published,
    stars: CREATOR_TIERS.maker.stars,
    downloads: 0,
  });
  assert.equal(next, null);
});

test('pickFeatured prende solo sopra la soglia, per stelle', () => {
  const skills = [
    { id: 'a/one', name: 'one', description: '', owner: 'a', stars: FEATURED_MIN_STARS - 1 },
    { id: 'a/two', name: 'two', description: '', owner: 'a', stars: FEATURED_MIN_STARS },
    { id: 'a/three', name: 'three', description: '', owner: 'a', stars: FEATURED_MIN_STARS + 10 },
  ];
  const picked = pickFeatured(skills, 3);
  assert.equal(picked.length, 2);
  assert.equal(picked[0].id, 'a/three');
  assert.equal(picked[1].id, 'a/two');
});

test('pickFeatured rispetta il limite', () => {
  const skills = Array.from({ length: 10 }, (_, i) => ({
    id: `a/s${i}`,
    name: `s${i}`,
    description: '',
    owner: 'a',
    stars: FEATURED_MIN_STARS + i,
  }));
  assert.equal(pickFeatured(skills, 3).length, 3);
});

test('isFeatured rispetta la soglia', () => {
  assert.equal(isFeatured(FEATURED_MIN_STARS), true);
  assert.equal(isFeatured(FEATURED_MIN_STARS - 1), false);
});
