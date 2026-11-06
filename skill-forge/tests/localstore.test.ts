import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearLocalSkills,
  markPublished,
  MAX_LOCAL_SKILLS,
  readLocalSkills,
  removeLocalSkill,
  saveLocalSkill,
  type StorageLike,
} from '../src/lib/localstore';

/** Storage in memoria: la logica e' pura, quindi non serve un browser. */
function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

test('archivio vuoto restituisce un elenco vuoto', () => {
  assert.deepEqual(readLocalSkills(fakeStorage()), []);
});

test('salva una skill e la ritrova', () => {
  const store = fakeStorage();
  const { skill } = saveLocalSkill(
    { markdown: '# A', name: 'Revisione', source: 'from-scratch' },
    store,
  );
  assert.equal(skill.id, 'revisione');
  assert.equal(skill.source, 'from-scratch');

  const saved = readLocalSkills(store);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'Revisione');
  assert.equal(saved[0].markdown, '# A');
});

test('salvare due volte la stessa skill la aggiorna, senza doppioni', () => {
  const store = fakeStorage();
  saveLocalSkill({ markdown: '# v1', name: 'Revisione' }, store);
  saveLocalSkill({ markdown: '# v2', name: 'Revisione' }, store);

  const saved = readLocalSkills(store);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].markdown, '# v2');
});

test('aggiornare conserva createdAt ma cambia updatedAt', async () => {
  const store = fakeStorage();
  const first = saveLocalSkill({ markdown: '# v1', name: 'X' }, store).skill;
  await new Promise((r) => setTimeout(r, 5));
  const second = saveLocalSkill({ markdown: '# v2', name: 'X' }, store).skill;

  assert.equal(second.createdAt, first.createdAt);
  assert.notEqual(second.updatedAt, first.updatedAt);
});

test('le skill piu\' recenti stanno in cima', () => {
  const store = fakeStorage();
  saveLocalSkill({ markdown: '# A', name: 'Alfa' }, store);
  saveLocalSkill({ markdown: '# B', name: 'Beta' }, store);
  assert.deepEqual(readLocalSkills(store).map((s) => s.name), ['Beta', 'Alfa']);
});

test('un nome assente non fa cadere il salvataggio', () => {
  const store = fakeStorage();
  const { skill } = saveLocalSkill({ markdown: '# A' }, store);
  assert.equal(skill.name, 'Skill senza nome');
  assert.equal(skill.id, 'skill-senza-nome');
});

test('markPublished registra l\'id sul marketplace', () => {
  const store = fakeStorage();
  saveLocalSkill({ markdown: '# A', name: 'Alfa' }, store);
  const skills = markPublished('alfa', 'ciao22king/alfa', store);
  assert.equal(skills[0].publishedId, 'ciao22king/alfa');
  assert.equal(readLocalSkills(store)[0].publishedId, 'ciao22king/alfa');
});

test('aggiornare una skill pubblicata ne conserva il riferimento', () => {
  const store = fakeStorage();
  saveLocalSkill({ markdown: '# A', name: 'Alfa' }, store);
  markPublished('alfa', 'ciao22king/alfa', store);
  saveLocalSkill({ markdown: '# A v2', name: 'Alfa' }, store);
  assert.equal(readLocalSkills(store)[0].publishedId, 'ciao22king/alfa');
});

test('removeLocalSkill toglie solo la skill indicata', () => {
  const store = fakeStorage();
  saveLocalSkill({ markdown: '# A', name: 'Alfa' }, store);
  saveLocalSkill({ markdown: '# B', name: 'Beta' }, store);
  const left = removeLocalSkill('alfa', store);
  assert.deepEqual(left.map((s) => s.name), ['Beta']);
});

test('clearLocalSkills svuota tutto', () => {
  const store = fakeStorage();
  saveLocalSkill({ markdown: '# A', name: 'Alfa' }, store);
  clearLocalSkills(store);
  assert.deepEqual(readLocalSkills(store), []);
});

test('un archivio corrotto non lancia, restituisce vuoto', () => {
  const store = fakeStorage({ 'skillforge:skills:v1': 'non-json{' });
  assert.deepEqual(readLocalSkills(store), []);
});

test('le voci malformate vengono scartate', () => {
  const store = fakeStorage({
    'skillforge:skills:v1': JSON.stringify([
      { id: 'ok', name: 'Valida', markdown: '# A' },
      { id: 42, name: 'Rotta' },
      null,
    ]),
  });
  const skills = readLocalSkills(store);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, 'Valida');
});

test('il tetto locale viene rispettato', () => {
  const store = fakeStorage();
  for (let i = 0; i < MAX_LOCAL_SKILLS + 25; i++) {
    saveLocalSkill({ markdown: '# A', name: `Skill ${i}` }, store);
  }
  assert.equal(readLocalSkills(store).length, MAX_LOCAL_SKILLS);
});

test('senza storage non lancia (browser in modalita\' privata)', () => {
  assert.deepEqual(readLocalSkills(undefined), []);
});
