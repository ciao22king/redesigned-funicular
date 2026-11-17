import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collapseWhitespace,
  hasMarkup,
  sanitizeField,
  sanitizeLogin,
  sanitizePublicText,
} from '../src/lib/sanitize';

test('i tag HTML vengono rimossi dai campi pubblici', () => {
  assert.equal(sanitizePublicText('<script>alert(1)</script>ciao'), 'alert(1)ciao');
  assert.equal(sanitizePublicText('nome <b>grassetto</b>'), 'nome grassetto');
});

test('le parentesi angolari residue spariscono', () => {
  // A complete pair is removed as a tag; a stray bracket is dropped on its own.
  assert.equal(sanitizePublicText('a <b> c'), 'a c');
  assert.equal(sanitizePublicText('a < b'), 'a b');
});

test('lo schema javascript viene neutralizzato', () => {
  assert.equal(sanitizePublicText('javascript:alert(1)'), 'alert(1)');
  assert.equal(sanitizePublicText('data:text/html,<h1>x</h1>'), ',x');
});

test('gli spazi bianchi vengono compattati', () => {
  assert.equal(collapseWhitespace('  a \n\n\t b  '), 'a b');
  assert.equal(sanitizePublicText('uno    due'), 'uno due');
});

test('i caratteri di controllo e a larghezza zero spariscono', () => {
  assert.equal(sanitizePublicText('a\u0000b'), 'a b');
  assert.equal(sanitizePublicText('ab\u200bc'), 'abc');
});

test('il campo viene troncato alla lunghezza massima', () => {
  assert.equal(sanitizeField('abcdef', 3), 'abc');
});

test('un login conserva solo i caratteri ammessi', () => {
  assert.equal(sanitizeLogin('ciao22king'), 'ciao22king');
  assert.equal(sanitizeLogin('a<b>c/d'), 'abcd');
});

test('hasMarkup riconosce cio che e stato rimosso', () => {
  assert.equal(hasMarkup('<b>x</b>'), true);
  assert.equal(hasMarkup('javascript:x'), true);
  assert.equal(hasMarkup('testo pulito'), false);
});
