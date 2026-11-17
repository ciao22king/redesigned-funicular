import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { fit, visibleLength, wrap, truncateVisible } from '../src/tui/text.js';

/**
 * The layout is only correct if every line occupies exactly the width of the
 * frame: one column of drift and the box tears. These tests pin that down.
 */

describe('tui/text', () => {
  test('fit porta ogni riga esattamente alla larghezza', () => {
    assert.equal(visibleLength(fit('ab', 5)), 5);
    assert.equal(visibleLength(fit('abcdefgh', 4)), 4);
    assert.equal(visibleLength(fit('', 3)), 3);
  });

  test('fit tronca con ellissi quando il testo e troppo lungo', () => {
    assert.equal(fit('abcdefgh', 4), 'abc…');
  });

  test('visibleLength ignora i codici ANSI', () => {
    assert.equal(visibleLength('\u001b[36mciao\u001b[0m'), 4);
  });

  test('truncateVisible non spezza una sequenza ANSI a meta', () => {
    const out = truncateVisible('\u001b[36mciao mondo\u001b[0m', 4);
    assert.equal(visibleLength(out), 4);
  });

  test('wrap spezza sulle parole e conserva l indentazione', () => {
    const lines = wrap('  una due tre quattro', 10);
    for (const line of lines) assert.ok(visibleLength(line) <= 10, `troppo larga: ${line}`);
    assert.ok(lines[0].startsWith('  '));
  });

  test('wrap spezza una parola piu larga della riga', () => {
    const lines = wrap('abcdefghijklmnop', 5);
    assert.ok(lines.every((l) => visibleLength(l) <= 5));
    assert.equal(lines.join(''), 'abcdefghijklmnop');
  });

  test('wrap di una riga vuota restituisce una riga vuota', () => {
    assert.deepEqual(wrap('   ', 10), ['']);
  });
});
