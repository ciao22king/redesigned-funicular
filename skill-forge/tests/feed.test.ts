import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeed, escapeXml } from '../src/lib/feed';
import type { SkillSummary } from '../src/lib/marketplace';

const META = {
  base: 'https://skillforge.eu.org',
  title: 'Skill Forge · newest skills',
  description: 'Newly published skills for AI agents.',
};

function skill(over: Partial<SkillSummary> = {}): SkillSummary {
  return {
    id: 'ciao22king/demo',
    owner: 'ciao22king',
    name: 'Demo',
    description: 'A demo skill.',
    tags: [],
    stars: 0,
    category: 'code',
    createdAt: '2026-11-06T10:00:00.000Z',
    updatedAt: '2026-11-06T10:00:00.000Z',
    ...over,
  };
}

test('escapeXml neutralizza i caratteri riservati', () => {
  assert.equal(escapeXml('a & b'), 'a &amp; b');
  assert.equal(escapeXml('<script>'), '&lt;script&gt;');
  assert.equal(escapeXml('"x"'), '&quot;x&quot;');
  assert.equal(escapeXml("it's"), 'it&apos;s');
});

test('escapeXml non lascia passare markup in un titolo', () => {
  const out = escapeXml('<img src=x onerror=alert(1)>');
  assert.equal(out.includes('<'), false);
  assert.equal(out.includes('>'), false);
});

test('buildFeed produce un documento RSS valido', () => {
  const feed = buildFeed([skill()], META);
  assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(feed, /<rss version="2\.0"/);
  assert.match(feed, /<item>/);
  assert.match(feed, /https:\/\/skillforge\.eu\.org\/skills\/ciao22king\/demo/);
});

test('buildFeed senza skill resta un canale valido e vuoto', () => {
  const feed = buildFeed([], META);
  assert.match(feed, /<channel>/);
  assert.equal(feed.includes('<item>'), false);
});

test('buildFeed escapa i dati di una skill ostile', () => {
  const feed = buildFeed(
    [skill({ name: 'A & B <x>', description: 'quote " here', owner: 'a&b' })],
    META,
  );
  assert.equal(feed.includes('A & B <x>'), false);
  assert.match(feed, /A &amp; B &lt;x&gt;/);
  assert.match(feed, /quote &quot; here/);
});

test('buildFeed mette un category per ogni tag', () => {
  const feed = buildFeed([skill({ tags: ['git', 'review'] })], META);
  assert.match(feed, /<category>git<\/category>/);
  assert.match(feed, /<category>review<\/category>/);
});

test('buildFeed usa una descrizione di riserva quando manca', () => {
  const feed = buildFeed([skill({ description: '' })], META);
  assert.match(feed, /A skill published by @ciao22king\./);
});
