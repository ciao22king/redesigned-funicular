import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  CATEGORY_META,
  categoryFor,
  categoryLabel,
  categoryMeta,
  changedFields,
  contentHash,
  isCategory,
  legacySkillPath,
  nextVersion,
  pickRelated,
  skillBreadcrumb,
  skillPath,
  skillSlugPath,
  versionNote,
  type VersionSnapshot,
} from '../src/lib/skill-page';

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

test('i percorsi di una skill sono owner/slug', () => {
  assert.equal(skillPath('ciao22king', 'plan'), '/skills/ciao22king/plan');
  assert.equal(skillSlugPath('plan'), '/skills/plan');
  assert.equal(legacySkillPath('ciao22king/plan'), '/s/ciao22king/plan');
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

test('ogni categoria ha metadati e un id valido', () => {
  for (const id of CATEGORIES) {
    assert.equal(isCategory(id), true, id);
    assert.equal(categoryMeta(id).id, id);
    assert.ok(categoryLabel(id).length > 0);
  }
  assert.equal(isCategory('nonsense'), false);
});

test('un tag esatto decide la categoria', () => {
  assert.equal(categoryFor({ tags: ['git'] }), 'code');
  assert.equal(categoryFor({ tags: ['devops'] }), 'ops');
  assert.equal(categoryFor({ tags: ['seo'] }), 'docs');
  assert.equal(categoryFor({ tags: ['accessibility'] }), 'design');
});

test('il testo decide la categoria quando i tag tacciono', () => {
  assert.equal(categoryFor({ name: 'Pull request review', markdown: 'Read the diff.' }), 'code');
  assert.equal(
    categoryFor({ description: 'Handle a production incident and write the postmortem.' }),
    'ops',
  );
});

test('una skill senza segnali finisce in other', () => {
  assert.equal(categoryFor({ name: 'Misc', markdown: 'Nothing specific here.' }), 'other');
  assert.equal(categoryFor({}), 'other');
});

test('un tag batte il testo generico', () => {
  // Il testo parla di codice, ma il tag dice chiaramente "docs": vince il tag.
  assert.equal(
    categoryFor({ tags: ['documentation'], markdown: 'This is about code review of git api.' }),
    'docs',
  );
});

test('la parola deve stare al confine: "capital" non attiva api', () => {
  assert.equal(categoryFor({ name: 'Capital', markdown: 'capital gains' }), 'other');
});

// ---------------------------------------------------------------------------
// Related
// ---------------------------------------------------------------------------

test('le skill correlate condividono tag o categoria', () => {
  const current = { id: 'a/one', tags: ['git', 'review'], category: 'code' };
  const candidates = [
    { id: 'b/two', tags: ['git'], category: 'ops', stars: 1 },
    { id: 'c/three', tags: [], category: 'code', stars: 50 },
    { id: 'd/four', tags: ['cooking'], category: 'other', stars: 100 },
  ];
  const related = pickRelated(candidates, current, 4);
  // d/four non condivide niente: resta fuori.
  assert.deepEqual(related.map((r) => r.id), ['b/two', 'c/three']);
});

test('le skill correlate non includono la skill corrente', () => {
  const current = { id: 'a/one', tags: ['git'], category: 'code' };
  const related = pickRelated([{ id: 'a/one', tags: ['git'], category: 'code' }], current);
  assert.deepEqual(related, []);
});

test('le skill correlate rispettano il limite', () => {
  const current = { id: 'a/one', tags: ['git'], category: 'code' };
  const candidates = Array.from({ length: 10 }, (_, i) => ({
    id: `x/${i}`,
    tags: ['git'],
    category: 'code',
    stars: i,
  }));
  assert.equal(pickRelated(candidates, current, 3).length, 3);
});

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

const SNAP: VersionSnapshot = {
  name: 'Plan',
  description: 'A plan.',
  tags: 'git',
  markdown: '# Plan',
};

test('il primo salvataggio e la versione 1', () => {
  assert.equal(nextVersion(0), 1);
  assert.equal(nextVersion(3), 4);
});

test("l'hash e stabile e cambia col contenuto", () => {
  assert.equal(contentHash(SNAP), contentHash({ ...SNAP }));
  assert.notEqual(contentHash(SNAP), contentHash({ ...SNAP, markdown: '# Plan 2' }));
});

test('i campi cambiati sono elencati in ordine di lettura', () => {
  const changed = changedFields(SNAP, { ...SNAP, description: 'New.', markdown: '# New' });
  assert.deepEqual(changed, ['the description', 'the body']);
  assert.deepEqual(changedFields(SNAP, SNAP), []);
});

test('la nota di versione dice cosa e cambiato', () => {
  assert.equal(versionNote(1, []), 'First published version.');
  assert.equal(versionNote(2, []), 'Republished without changes.');
  assert.equal(versionNote(2, ['the body']), 'Updated the body.');
  assert.equal(versionNote(2, ['the name', 'the body']), 'Updated the name and the body.');
});

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

test('il breadcrumb e Home > Skills > Categoria > Nome', () => {
  const crumbs = skillBreadcrumb({ skillName: 'Plan', category: 'code' });
  assert.deepEqual(
    crumbs.map((c) => c.label),
    ['Home', 'Skills', 'Code & engineering', 'Plan'],
  );
  assert.equal(crumbs[0].href, '/');
  assert.equal(crumbs[1].href, '/skills');
  assert.equal(crumbs[2].href, '/skills/category/code');
  // L'ultimo non e un link: e la pagina stessa.
  assert.equal(crumbs[3].href, undefined);
});

test('CATEGORY_META copre tutte le categorie', () => {
  assert.equal(CATEGORY_META.length, CATEGORIES.length);
  assert.deepEqual(
    CATEGORY_META.map((c) => c.id),
    [...CATEGORIES],
  );
});
