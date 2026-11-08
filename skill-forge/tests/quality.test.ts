import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkQuality, splitSections, REQUIRED_SECTIONS } from '../src/lib/quality';
import { parseSkill, serializeSkill, replaceSection, regenerableSections } from '../src/lib/sections';

const GOOD = `---
name: example
description: An example skill that shows the full structure the generator must produce.
---

# Example

## When to use it
When the user asks for an example of a complete skill document. When a reviewer
needs a reference to compare a generated document against. When the structure
itself is in question and a concrete sample answers it faster than a description.

## When NOT to use it
When there is no example to give. When the request is about the generator itself
rather than about the output it produces. When the material is still incomplete
and the structure would only hide the gap.

## Prerequisites
None. This document is self-contained and needs no tool, no access and no prior
knowledge. If a check needs a tool, name the tool here before the procedure.

## Procedure
1. Read the request carefully before answering, so the answer matches what was
   actually asked and not what the first line suggested.
2. Gather the material that the request refers to, and note which part of the
   material each section of the answer will come from.
3. Write the answer in the requested format, then read it once more against the
   checklist at the end of this document.
4. Where the material does not say something, write it under Missing information
   and phrase the question whose answer would close it.
5. Deliver the answer as a single document, with no commentary around it.

## Rules and constraints
The answer must be short and must contain only verifiable statements. The
procedure must name each action in the order it is performed. Every example must
show both the input and the expected output.

## Examples

### Input
A request for an example of a complete skill document.

### Expected output
A document with this structure, with every section filled and no invented fact.

## Common mistakes
- Answering before reading the request, which produces a plausible but wrong answer.
- Leaving a section empty instead of writing "None" when nothing applies.
- Inventing a version number or a path instead of listing it as missing.

## Final checklist
- [ ] The request was read before answering
- [ ] The answer matches the requested format
- [ ] No fact was invented where the material was silent
`;

test('una skill completa non ha errori', () => {
  const report = checkQuality(GOOD);
  const errors = report.findings.filter((f) => f.level === 'error');
  assert.deepEqual(errors, [], `errori inattesi: ${JSON.stringify(errors)}`);
  assert.equal(report.ok, true);
  assert.ok(report.score > 60);
});

test('ogni sezione obbligatoria mancante e un errore', () => {
  for (const section of REQUIRED_SECTIONS) {
    const without = GOOD.replace(new RegExp(`## ${section}\\n[\\s\\S]*?(?=\\n## |$)`), '');
    const report = checkQuality(without);
    assert.ok(
      report.findings.some((f) => f.code === `missing-section:${section}`),
      `la rimozione di "${section}" deve produrre un errore`,
    );
  }
});

test('una skill troppo corta e segnalata', () => {
  const report = checkQuality('# T\n\n## When to use it\nAlways.');
  assert.ok(report.findings.some((f) => f.code === 'too-short'));
});

test('una procedura con pochi passi e segnalata', () => {
  const thin = GOOD.replace(/## Procedure\n[\s\S]*?(?=\n## )/, '## Procedure\n1. Do the thing.\n');
  const report = checkQuality(thin);
  assert.ok(report.findings.some((f) => f.code === 'few-steps'));
});

test('i termini ambigui sono segnalati', () => {
  const vague = GOOD.replace(
    'Read the request carefully before answering',
    'Consider reading the request, maybe',
  );
  const report = checkQuality(vague);
  assert.ok(report.findings.some((f) => f.code === 'hedging'));
});

test('una checklist vuota e segnalata', () => {
  const withoutList = GOOD.replace(
    /## Final checklist\n[\s\S]*$/,
    '## Final checklist\n',
  );
  const report = checkQuality(withoutList);
  assert.ok(report.findings.some((f) => f.code === 'thin-checklist'));
});

test('splitSections legge i titoli e i corpi', () => {
  const sections = splitSections(GOOD);
  assert.ok(sections.some((s) => s.title === 'Procedure'));
  assert.ok(sections.find((s) => s.title === 'Procedure')?.body.includes('Read the request'));
});

test('parseSkill separa testa e sezioni', () => {
  const parsed = parseSkill(GOOD);
  assert.ok(parsed.head.includes('name: example'));
  assert.ok(parsed.head.includes('# Example'));
  assert.equal(parsed.sections[0].title, 'When to use it');
});

test('serializeSkill ricostruisce il documento', () => {
  const parsed = parseSkill(GOOD);
  const rebuilt = serializeSkill(parsed);
  assert.equal(parseSkill(rebuilt).sections.length, parsed.sections.length);
  assert.ok(rebuilt.includes('name: example'));
});

test('replaceSection cambia una sola sezione', () => {
  const updated = replaceSection(GOOD, 'Common mistakes', 'Nothing to add.');
  assert.ok(updated.includes('## Common mistakes\n\nNothing to add.'));
  assert.ok(updated.includes('## Procedure'), 'le altre sezioni devono restare');
  assert.ok(updated.includes('name: example'), 'la testa deve restare');
});

test('replaceSection non tocca nulla se il titolo non esiste', () => {
  assert.equal(replaceSection(GOOD, 'Nonexistent section', 'x'), GOOD);
});

test('regenerableSections elenca i titoli presenti', () => {
  const titles = regenerableSections(GOOD);
  assert.ok(titles.includes('Procedure'));
  assert.ok(titles.includes('Final checklist'));
});
