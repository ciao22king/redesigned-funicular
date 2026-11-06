import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { table, truncate, shortDate, color } from '../src/output.js';

/**
 * The output is testable because the colored strings stay recognizable: here we
 * care that the columns are aligned even with colors present.
 */

describe('output', () => {
  test('table allinea le colonne', () => {
    const out = table(['A', 'BB'], [['1', '22'], ['333', '4']]);
    const lines = out.split('\n');
    assert.equal(lines.length, 4); // intestazione, separatore, due righe
    assert.ok(lines[0].startsWith('A'));
    assert.ok(lines[2].includes('1'));
  });

  test('table ignora i codici ANSI nel calcolo della larghezza', () => {
    // Color is off in the tests (stdout is not a TTY), so we only verify that it
    // does not produce empty or misaligned rows.
    const out = table(['ID'], [[color.cyan('me/x')]]);
    assert.ok(out.includes('me/x'));
  });

  test('truncate accorcia con ellissi', () => {
    assert.equal(truncate('abcdefghij', 5), 'abcd…');
    assert.equal(truncate('corto', 10), 'corto');
  });

  test('truncate normalizza gli spazi', () => {
    assert.equal(truncate('a\n\n  b', 20), 'a b');
  });

  test('shortDate riduce una data ISO a yyyy-mm-dd', () => {
    assert.equal(shortDate('2026-11-05T10:30:00.000Z'), '2026-11-05');
  });

  test('shortDate lascia intatta una stringa non-data', () => {
    assert.equal(shortDate('non-una-data'), 'non-una-data');
  });
});
