import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isFoundingTesterRole,
  isOperatorRole,
  isRole,
  isUnlimitedRole,
  roleBadge,
  roleFor,
  roleLabel,
  roleSources,
  type RoleSources,
} from '../src/lib/roles';

const SOURCES: RoleSources = {
  owners: ['ciao22king'],
  foundingTesters: ['hxreborn', 'akkie76'],
};

test('il proprietario ha il ruolo owner', () => {
  assert.equal(roleFor('ciao22king', SOURCES), 'owner');
});

test('un tester fondatore ha il suo ruolo', () => {
  assert.equal(roleFor('hxreborn', SOURCES), 'founding_tester');
});

test('chi non e in nessuna lista e member', () => {
  assert.equal(roleFor('sconosciuto', SOURCES), 'member');
});

test('il confronto ignora maiuscole e spazi', () => {
  assert.equal(roleFor('  Ciao22King ', SOURCES), 'owner');
  assert.equal(roleFor('HXREBORN', SOURCES), 'founding_tester');
});

test("l'owner vince se un login compare in entrambe le liste", () => {
  const both: RoleSources = { owners: ['x'], foundingTesters: ['x'] };
  assert.equal(roleFor('x', both), 'owner');
});

test('solo owner e esente dalla quota', () => {
  assert.equal(isUnlimitedRole('owner'), true);
  assert.equal(isUnlimitedRole('founding_tester'), false);
  assert.equal(isUnlimitedRole('member'), false);
});

test('il founding tester ha un ruolo dedicato per la quota maggiorata', () => {
  assert.equal(isFoundingTesterRole('founding_tester'), true);
  assert.equal(isFoundingTesterRole('owner'), false);
  assert.equal(isFoundingTesterRole('member'), false);
});

test('solo owner e operatore', () => {
  assert.equal(isOperatorRole('owner'), true);
  assert.equal(isOperatorRole('founding_tester'), false);
  assert.equal(isOperatorRole('member'), false);
});

test('il badge esiste solo per i ruoli speciali', () => {
  assert.equal(roleBadge('owner'), 'Owner');
  assert.equal(roleBadge('founding_tester'), 'Founding tester');
  assert.equal(roleBadge('member'), null);
});

test('le etichette sono stabili', () => {
  assert.equal(roleLabel('owner'), 'Owner');
  assert.equal(roleLabel('founding_tester'), 'Founding tester');
  assert.equal(roleLabel('member'), 'Member');
});

test('isRole accetta solo i ruoli noti', () => {
  assert.equal(isRole('owner'), true);
  assert.equal(isRole('founding_tester'), true);
  assert.equal(isRole('member'), true);
  assert.equal(isRole('admin'), false);
  assert.equal(isRole(null), false);
});

test('roleSources legge e normalizza le liste dalla configurazione', () => {
  const s = roleSources({ UNLIMITED_LOGINS: 'A, b ,,C', FOUNDING_TESTERS: ' D ,e' });
  assert.deepEqual(s.owners, ['a', 'b', 'c']);
  assert.deepEqual(s.foundingTesters, ['d', 'e']);
});

test('roleSources ha un default sensato quando manca la configurazione', () => {
  const s = roleSources({});
  assert.deepEqual(s.owners, ['ciao22king']);
  assert.deepEqual(s.foundingTesters, []);
});
