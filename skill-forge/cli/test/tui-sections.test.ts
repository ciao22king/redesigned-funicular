import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseDocument } from '../src/tui/sections.js';

describe('tui/sections', () => {
  test('separa frontmatter e titolo dalle sezioni', () => {
    const md = [
      '---',
      'name: demo',
      '---',
      '',
      '# Titolo',
      '',
      '## When to use it',
      'Usala quando serve.',
      '',
      '## Procedure',
      '1. Fai questo.',
    ].join('\n');

    const doc = parseDocument(md);
    assert.equal(doc.sections.length, 2);
    assert.equal(doc.sections[0].title, 'When to use it');
    assert.equal(doc.sections[0].body, 'Usala quando serve.');
    assert.ok(doc.head.includes('# Titolo'));
    assert.ok(doc.head.includes('name: demo'));
  });

  test('un titolo di terzo livello resta una sezione a se', () => {
    const md = '## A\n\n### B\n\ncorpo\n';
    const doc = parseDocument(md);
    assert.equal(doc.sections.length, 2);
    assert.equal(doc.sections[1].title, 'B');
    assert.equal(doc.sections[1].level, 3);
  });

  test('un titolo di quarto livello non apre una sezione', () => {
    const md = '## A\n\n#### profondo\n\ntesto\n';
    const doc = parseDocument(md);
    assert.equal(doc.sections.length, 1);
    assert.ok(doc.sections[0].body.includes('#### profondo'));
  });

  test('un documento senza sezioni non ne inventa', () => {
    const doc = parseDocument('# Solo titolo\n\ntesto\n');
    assert.equal(doc.sections.length, 0);
    assert.ok(doc.head.includes('Solo titolo'));
  });

  test('il corpo non trattiene righe vuote ai bordi', () => {
    const doc = parseDocument('## A\n\n\ncorpo\n\n\n');
    assert.equal(doc.sections[0].body, 'corpo');
  });
});
