import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { slugify, stripFences, readFrontmatterName, readFrontmatterDescription } from '../src/skill.js';

describe('skill helpers', () => {
  test('slugify produce kebab-case', () => {
    assert.equal(slugify('Deploy su Docker!'), 'deploy-su-docker');
    assert.equal(slugify('Caffè e Città'), 'caffe-e-citta');
    assert.equal(slugify('  spazi  attorno  '), 'spazi-attorno');
  });

  test('slugify ha un fallback per input vuoto', () => {
    assert.equal(slugify('!!!'), 'untitled-skill');
    assert.equal(slugify(''), 'untitled-skill');
  });

  test('stripFences toglie il blocco markdown', () => {
    const fenced = '```markdown\n---\nname: X\n---\n\n# Titolo\n```';
    assert.equal(stripFences(fenced), '---\nname: X\n---\n\n# Titolo');
  });

  test('stripFences lascia intatto il testo senza fence', () => {
    const plain = '---\nname: X\n---';
    assert.equal(stripFences(plain), plain);
  });

  test('legge name e description dal frontmatter', () => {
    const md = '---\nname: Docker Deploy\ndescription: "Guida al deploy"\n---\n\n# Corpo';
    assert.equal(readFrontmatterName(md), 'Docker Deploy');
    assert.equal(readFrontmatterDescription(md), 'Guida al deploy');
  });

  test('senza frontmatter restituisce undefined', () => {
    assert.equal(readFrontmatterName('# Solo un titolo'), undefined);
  });
});
