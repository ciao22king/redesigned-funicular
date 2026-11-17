import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSkill,
  stripDashes,
  procedureSteps,
  synthesizeChecklist,
} from '../src/lib/normalize';
import { validateSkillOutput } from '../src/lib/guardrails';
import { checkQuality } from '../src/lib/quality';
import { parseSkill } from '../src/lib/sections';

/**
 * The normaliser is what makes a sloppy draft usable as it arrives. These tests
 * pin the guarantees: canonical shape, no em dashes, and idempotence, which is
 * what lets it run after both the draft and the refine pass without drift.
 */

const SLOPPY = `\`\`\`markdown
---
name: Release Readiness
---

# Release readiness

## Procedure
1. Read the diff.
2. Check the changelog.
3. Bump the version.
4. Verify the migration down path.

## When to use it
Use it before merging a release PR \u2014 always.

## Examples
### Input
A pull request that bumps the version but not the changelog.
### Expected output
The review flags the missing changelog entry before the merge.
\`\`\``;

test('normalizza un draft sciatto in una skill valida', () => {
  const { markdown, applied } = normalizeSkill(SLOPPY);
  const check = validateSkillOutput(markdown);
  assert.equal(check.ok, true, check.reason);
  assert.ok(applied.length > 0);
  // The shape is guaranteed: every required section is present, so the quality
  // check finds no missing section even though the draft arrived sloppy.
  const quality = checkQuality(markdown);
  assert.equal(quality.findings.some((f) => f.code.startsWith('missing-section')), false);
});

test('toglie i code fence e crea il frontmatter mancante', () => {
  const { markdown } = normalizeSkill('# My Skill\n\n## Procedure\n1. a\n2. b\n3. c\n');
  assert.ok(!markdown.includes('```'));
  assert.match(markdown, /^---\nname: my-skill\ndescription: /);
  assert.match(markdown, /^# My Skill$/m);
});

test('mette le sezioni nell ordine canonico', () => {
  const { markdown } = normalizeSkill(SLOPPY);
  const titles = parseSkill(markdown).sections.map((s) => s.title);
  const whenIdx = titles.indexOf('When to use it');
  const procIdx = titles.indexOf('Procedure');
  assert.ok(whenIdx >= 0 && procIdx >= 0);
  assert.ok(whenIdx < procIdx, 'When to use it deve precedere Procedure');
});

test('sintetizza la checklist finale dalla procedura', () => {
  const { markdown, applied } = normalizeSkill(SLOPPY);
  assert.ok(applied.some((a) => a.includes('checklist')));
  const checklist = parseSkill(markdown).sections.find((s) => s.title === 'Final checklist');
  assert.ok(checklist);
  assert.ok(checklist!.body.includes('[ ]'));
  assert.match(checklist!.body, /Read the diff/);
});

test('riempie con "None" le sezioni opzionali mancanti', () => {
  const { markdown } = normalizeSkill(SLOPPY);
  const titles = parseSkill(markdown).sections.map((s) => s.title);
  for (const t of ['When NOT to use it', 'Prerequisites', 'Rules and constraints', 'Common mistakes']) {
    assert.ok(titles.includes(t), t);
  }
});

test('segnala le sezioni essenziali che restano assenti', () => {
  const { unresolved } = normalizeSkill('---\nname: x\ndescription: y\n---\n\n# X\n\n## Prerequisites\nNone.\n');
  assert.ok(unresolved.includes('Procedure'));
  assert.ok(unresolved.includes('Examples'));
});

test('e idempotente', () => {
  const once = normalizeSkill(SLOPPY).markdown;
  const twice = normalizeSkill(once).markdown;
  assert.equal(twice, once);
});

test('sostituisce i trattini lunghi', () => {
  assert.equal(stripDashes('a \u2014 b'), 'a, b');
  assert.equal(stripDashes('1\u20135'), '1-5');
  assert.ok(!normalizeSkill('# T\n\n## Procedure\n1. a \u2014 b\n2. c\n3. d\n').markdown.includes('\u2014'));
});

test('procedureSteps e synthesizeChecklist estraggono i passi', () => {
  const steps = procedureSteps('1. Primo passo.\n2) Secondo passo.\ntesto non numerato');
  assert.deepEqual(steps, ['Primo passo.', 'Secondo passo.']);
  const items = synthesizeChecklist('1. Primo passo.\n2. Secondo passo.');
  assert.equal(items.length, 2);
  assert.match(items[0], /\[ \] Primo passo\./);
});
