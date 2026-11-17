import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateTags,
  deserializeTags,
  normalizeQuery,
  normalizeTag,
  orderClause,
  parseSkillId,
  parseSort,
  parseTags,
  serializeTags,
  skillId,
  tagClause,
  toDetail,
  toSummary,
  validateSkillInput,
  MAX_TAG_CHARS,
  TRENDING,
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

test('orderClause mappa i quattro ordinamenti', () => {
  assert.match(orderClause('stars'), /stars DESC/);
  assert.match(orderClause('name'), /COLLATE NOCASE/);
  assert.match(orderClause('recent'), /created_at DESC/);
  assert.match(orderClause('trending'), /pow\(/);
  assert.match(orderClause('trending'), /stars DESC/);
});

test('orderClause trending pesa le stelle recenti e decresce col tempo', () => {
  const clause = orderClause('trending');
  // Recent stars come from the `stars` table, limited to the window.
  assert.match(clause, /FROM stars/);
  assert.match(clause, new RegExp(`-${TRENDING.RECENT_WINDOW_DAYS} days`));
  // The decay exponent is the configured one, not a magic number.
  assert.ok(clause.includes(String(TRENDING.GRAVITY)));
  assert.ok(clause.includes(String(TRENDING.VELOCITY_WEIGHT)));
});

test('parseSort accetta solo valori noti', () => {
  assert.equal(parseSort('stars'), 'stars');
  assert.equal(parseSort('name'), 'name');
  assert.equal(parseSort('trending'), 'trending');
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
  category: 'code',
  status: 'published',
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

// --- Tags: discovery ---------------------------------------------------------

test('normalizeTag riporta una tag a kebab-case', () => {
  assert.equal(normalizeTag('Code Review'), 'code-review');
  assert.equal(normalizeTag('  Git  '), 'git');
  assert.equal(normalizeTag('a'.repeat(100)).length, MAX_TAG_CHARS);
});

test('normalizeTag rifiuta un valore vuoto o non valido', () => {
  assert.equal(normalizeTag(''), '');
  assert.equal(normalizeTag(null), '');
  assert.equal(normalizeTag('!!!'), '');
});

test('tagClause fa un match esatto e non un prefisso', () => {
  const { sql, params } = tagClause('git');
  // The commas around the column and the term prevent `git` matching `github`.
  assert.match(sql, /'\,' \|\| tags \|\| '\,'/);
  assert.deepEqual(params, ['%,git,%']);
});

test('tagClause senza tag non aggiunge clausole', () => {
  assert.deepEqual(tagClause(''), { sql: '', params: [] });
  assert.deepEqual(tagClause(undefined), { sql: '', params: [] });
});

test('aggregateTags conta, ordina e limita', () => {
  const rows = [
    { tags: 'git,review' },
    { tags: 'git' },
    { tags: 'ai,git' },
    { tags: '' },
  ];
  const counts = aggregateTags(rows);
  assert.deepEqual(counts[0], { tag: 'git', count: 3 });
  assert.deepEqual(counts[1], { tag: 'ai', count: 1 });
  assert.deepEqual(counts[2], { tag: 'review', count: 1 });
});

test('aggregateTags rispetta il limite', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ tags: `tag${i}` }));
  assert.equal(aggregateTags(rows, 3).length, 3);
});

test('aggregateTags su nessuna riga restituisce lista vuota', () => {
  assert.deepEqual(aggregateTags([]), []);
});
