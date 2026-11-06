import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deserializeTags,
  normalizeQuery,
  orderClause,
  parseSkillId,
  parseSort,
  parseTags,
  serializeTags,
  skillId,
  toDetail,
  toSummary,
  validateSkillInput,
  type SkillRow,
} from '../src/lib/marketplace';

const SAMPLE = `---
name: Revisione del codice
description: Rivede una pull request con criteri espliciti.
---

# Revisione del codice

## Quando usarla
Sempre, prima del merge.`;

test('skillId compone owner e slug', () => {
  assert.equal(skillId('ciao22king', 'revisione-codice'), 'ciao22king/revisione-codice');
});

test('parseSkillId scompone un id valido', () => {
  assert.deepEqual(parseSkillId('ciao22king/revisione-codice'), {
    owner: 'ciao22king',
    slug: 'revisione-codice',
  });
});

test('parseSkillId rifiuta id senza owner o senza slug', () => {
  assert.equal(parseSkillId('senza-slash'), undefined);
  assert.equal(parseSkillId('/slug'), undefined);
  assert.equal(parseSkillId('owner/'), undefined);
});

test('validateSkillInput ricava nome e descrizione dal frontmatter', () => {
  const result = validateSkillInput({ markdown: SAMPLE });
  assert.equal(result.ok, true);
  assert.equal(result.value?.name, 'Revisione del codice');
  assert.equal(result.value?.description, 'Rivede una pull request con criteri espliciti.');
  assert.equal(result.value?.slug, 'revisione-del-codice');
});

test('validateSkillInput preferisce i campi espliciti al frontmatter', () => {
  const result = validateSkillInput({
    markdown: SAMPLE,
    name: 'Nome scelto',
    description: 'Descrizione scelta',
  });
  assert.equal(result.value?.name, 'Nome scelto');
  assert.equal(result.value?.description, 'Descrizione scelta');
  assert.equal(result.value?.slug, 'nome-scelto');
});

test('validateSkillInput rifiuta una skill vuota', () => {
  const result = validateSkillInput({ markdown: '   ' });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /empty/i);
});

test('validateSkillInput rifiuta un markdown senza nome', () => {
  const result = validateSkillInput({ markdown: '# Solo un titolo\n\nsenza frontmatter' });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /name/i);
});

test('validateSkillInput rifiuta nome troppo lungo', () => {
  const result = validateSkillInput({ markdown: SAMPLE, name: 'x'.repeat(200) });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /too long/i);
});

test('validateSkillInput rifiuta descrizione troppo lunga', () => {
  const result = validateSkillInput({ markdown: SAMPLE, description: 'x'.repeat(500) });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /description/i);
});

test('validateSkillInput rifiuta un markdown oltre il tetto', () => {
  const result = validateSkillInput({ markdown: SAMPLE + '\n' + 'a'.repeat(30_000) });
  assert.equal(result.ok, false);
});

test('parseTags normalizza, deduplica e limita', () => {
  assert.deepEqual(parseTags(['Code Review', 'code-review', 'git']), ['code-review', 'git']);
  assert.deepEqual(parseTags('git, testing  git'), ['git', 'testing']);
  assert.deepEqual(parseTags(undefined), []);
});

test('parseTags taglia al massimo consentito', () => {
  const many = Array.from({ length: 20 }, (_, i) => `tag${i}`);
  assert.equal(parseTags(many).length, 6);
});

test('parseTags tronca i tag troppo lunghi', () => {
  const [tag] = parseTags(['a'.repeat(100)]);
  assert.ok(tag.length <= 24);
});

test('serializeTags e deserializeTags sono inverse', () => {
  const tags = ['git', 'testing'];
  assert.deepEqual(deserializeTags(serializeTags(tags)), tags);
  assert.deepEqual(deserializeTags(null), []);
  assert.deepEqual(deserializeTags(''), []);
});

test('orderClause mappa i tre ordinamenti', () => {
  assert.match(orderClause('stars'), /stars DESC/);
  assert.match(orderClause('name'), /COLLATE NOCASE/);
  assert.match(orderClause('recent'), /created_at DESC/);
});

test('parseSort accetta solo valori noti', () => {
  assert.equal(parseSort('stars'), 'stars');
  assert.equal(parseSort('name'), 'name');
  assert.equal(parseSort('boh'), 'recent');
  assert.equal(parseSort(null), 'recent');
});

test('normalizeQuery ripulisce e tronca', () => {
  assert.equal(normalizeQuery('  git  '), 'git');
  assert.equal(normalizeQuery(null), '');
  assert.equal(normalizeQuery('x'.repeat(200)).length, 80);
});

const ROW: SkillRow = {
  id: 'ciao22king/revisione-del-codice',
  slug: 'revisione-del-codice',
  owner: 'ciao22king',
  name: 'Revisione del codice',
  description: 'Rivede una pull request.',
  markdown: SAMPLE,
  tags: 'git,review',
  stars: 7,
  created_at: '2026-11-05T10:00:00.000Z',
  updated_at: '2026-11-05T11:00:00.000Z',
};

test('toSummary non espone il markdown e scioglie i tag', () => {
  const summary = toSummary(ROW);
  assert.equal('markdown' in summary, false);
  assert.deepEqual(summary.tags, ['git', 'review']);
  assert.equal(summary.stars, 7);
  assert.equal(summary.starred, false);
});

test("toSummary legge la stella dell'utente", () => {
  assert.equal(toSummary(ROW, true).starred, true);
});

test('toDetail include il markdown', () => {
  const detail = toDetail(ROW);
  assert.equal(detail.markdown, SAMPLE);
  assert.equal(detail.id, ROW.id);
});
