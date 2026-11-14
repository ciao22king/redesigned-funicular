import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, stripFrontmatter, stripInline } from '../src/lib/markdown';

const DOC = `---
name: Demo
description: A demo skill.
---

# Title

Intro paragraph that
wraps over two lines.

## Procedure

1. First step
2. Second step

- note one
- note two

\`\`\`bash
echo hi
\`\`\`

**Bold** and \`code\` inline.`;

test('stripFrontmatter removes the YAML block', () => {
  assert.equal(stripFrontmatter(DOC).startsWith('# Title'), true);
  assert.equal(stripFrontmatter('no frontmatter here'), 'no frontmatter here');
});

test('stripInline drops emphasis markers but keeps words', () => {
  assert.equal(stripInline('**Bold** and `code` inline.'), 'Bold and code inline.');
  assert.equal(stripInline('*italic*'), 'italic');
});

test('parseMarkdown classifies headings, lists, code and paragraphs', () => {
  const blocks = parseMarkdown(DOC);
  const types = blocks.map((b) => b.type);
  assert.deepEqual(types, [
    'heading',
    'paragraph',
    'heading',
    'list',
    'list',
    'code',
    'paragraph',
  ]);

  const h1 = blocks[0];
  assert.equal(h1.type, 'heading');
  if (h1.type === 'heading') assert.equal(h1.level, 1);

  const ordered = blocks[3];
  assert.equal(ordered.type, 'list');
  if (ordered.type === 'list') {
    assert.equal(ordered.ordered, true);
    assert.deepEqual(ordered.items, ['First step', 'Second step']);
  }

  const bullet = blocks[4];
  if (bullet.type === 'list') assert.equal(bullet.ordered, false);

  const code = blocks[5];
  if (code.type === 'code') assert.equal(code.text, 'echo hi');
});

test('parseMarkdown never produces HTML (no raw tag leaks)', () => {
  const blocks = parseMarkdown('<script>alert(1)</script>\n\n# <b>x</b>');
  const json = JSON.stringify(blocks);
  // The tags survive as text (the renderer escapes them), but no block type
  // is "html": the parser has no HTML concept at all.
  assert.equal(blocks.some((b) => (b as { type: string }).type === 'html'), false);
  assert.match(json, /<script>/);
});
