import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_ACTIONS,
  describeEvent,
  isAuditAction,
  MAX_DETAIL_CHARS,
  toAuditValues,
} from '../src/lib/audit';

test('le azioni note sono accettate', () => {
  for (const action of AUDIT_ACTIONS) {
    assert.equal(isAuditAction(action), true, action);
  }
});

test('un azione sconosciuta viene rifiutata', () => {
  assert.equal(isAuditAction('delete-everything'), false);
});

test('l attore predefinito e anonimo', () => {
  const values = toAuditValues({ actor: '', action: 'star', target: 'a/b' });
  assert.equal(values.actor, 'anonymous');
});

test('il dettaglio e troncato alla lunghezza massima', () => {
  const values = toAuditValues({
    actor: 'u',
    action: 'report',
    target: 'a/b',
    detail: 'x'.repeat(MAX_DETAIL_CHARS + 50),
  });
  assert.equal(values.detail.length, MAX_DETAIL_CHARS);
});

test('i campi sono limitati in lunghezza', () => {
  const values = toAuditValues({
    actor: 'a'.repeat(200),
    action: 'publish',
    target: 'b'.repeat(500),
    ip: 'c'.repeat(200),
  });
  assert.ok(values.actor.length <= 60);
  assert.ok(values.target.length <= 300);
  assert.ok(values.ip.length <= 60);
});

test('l evento porta sempre una data ISO', () => {
  const values = toAuditValues({ actor: 'u', action: 'star', target: 'a/b' });
  assert.ok(!Number.isNaN(Date.parse(values.at)));
});

test('describeEvent produce una riga leggibile', () => {
  assert.equal(describeEvent({ actor: 'u', action: 'publish', target: 'u/s' }), 'u publish u/s');
});
