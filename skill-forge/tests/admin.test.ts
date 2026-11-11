import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adminLogins,
  CREATORS_CSV_HEADERS,
  creatorStatus,
  creatorStatusLabel,
  csvEscape,
  DEFAULT_SKILL_STATUS,
  isAdmin,
  isCreatorStatus,
  isPublicSkillStatus,
  isSkillStatus,
  SKILL_STATUS_ACTIONS,
  SKILL_STATUSES,
  SKILLS_CSV_HEADERS,
  skillStatusLabel,
  toCsv,
} from '../src/lib/admin';

test('solo i login in lista entrano nel pannello', () => {
  const env = { ADMIN_LOGINS: 'ciao22king, Helper' };
  assert.equal(isAdmin('ciao22king', env), true);
  assert.equal(isAdmin('Helper', env), true);
  assert.equal(isAdmin('helper', env), true);
  assert.equal(isAdmin('someone', env), false);
  assert.equal(isAdmin(undefined, env), false);
  assert.equal(isAdmin('', env), false);
});

test('senza configurazione il pannello resta del proprietario', () => {
  assert.deepEqual(adminLogins({}), ['ciao22king']);
  assert.equal(isAdmin('ciao22king', {}), true);
  assert.equal(isAdmin('random', {}), false);
});

test('lo stato di uno skill e un insieme chiuso', () => {
  for (const s of SKILL_STATUSES) assert.equal(isSkillStatus(s), true);
  assert.equal(isSkillStatus('nonsense'), false);
  assert.equal(DEFAULT_SKILL_STATUS, 'published');
});

test('solo lo stato published e pubblico', () => {
  assert.equal(isPublicSkillStatus('published'), true);
  assert.equal(isPublicSkillStatus('pending'), false);
  assert.equal(isPublicSkillStatus('rejected'), false);
  assert.equal(isPublicSkillStatus('removed'), false);
  assert.equal(isPublicSkillStatus(undefined), false);
});

test('ogni azione di moderazione punta a uno stato valido', () => {
  for (const action of SKILL_STATUS_ACTIONS) {
    assert.equal(isSkillStatus(action.status), true);
    assert.ok(action.label.length > 0);
  }
});

test('un etichetta di stato sconosciuto torna com e', () => {
  assert.equal(skillStatusLabel('published'), 'Published');
  assert.equal(skillStatusLabel('weird'), 'weird');
});

test('lo standing di un creator deriva dai due flag, il ban vince', () => {
  assert.equal(creatorStatus({ banned: false, suspended: false }), 'active');
  assert.equal(creatorStatus({ banned: false, suspended: true }), 'suspended');
  assert.equal(creatorStatus({ banned: true, suspended: false }), 'banned');
  assert.equal(creatorStatus({ banned: true, suspended: true }), 'banned');
});

test('uno standing sconosciuto non e valido', () => {
  assert.equal(isCreatorStatus('active'), true);
  assert.equal(isCreatorStatus('banned'), true);
  assert.equal(isCreatorStatus('deleted'), false);
  assert.equal(creatorStatusLabel('banned'), 'Banned');
});

test('csvEscape cita virgole, virgolette e a capo', () => {
  assert.equal(csvEscape('plain'), 'plain');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('a"b'), '"a""b"');
  assert.equal(csvEscape('a\nb'), '"a\nb"');
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(7), '7');
});

test('csvEscape neutralizza una formula in una cella', () => {
  assert.equal(csvEscape('=1+1'), '"\'=1+1"');
  assert.equal(csvEscape('+x'), '"\'+x"');
  assert.equal(csvEscape('-x'), '"\'-x"');
  assert.equal(csvEscape('@x'), '"\'@x"');
});

test('toCsv scrive intestazione e righe con a capo CRLF', () => {
  const csv = toCsv(['a', 'b'], [
    [1, 'x,y'],
    [2, 'z'],
  ]);
  assert.equal(csv, 'a,b\r\n1,"x,y"\r\n2,z\r\n');
});

test('le intestazioni di export hanno le colonne attese', () => {
  assert.deepEqual(CREATORS_CSV_HEADERS.slice(0, 3), ['login', 'display_name', 'status']);
  assert.deepEqual(SKILLS_CSV_HEADERS.slice(0, 3), ['id', 'owner', 'name']);
});
