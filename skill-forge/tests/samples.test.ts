import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SAMPLE, SAMPLES } from '../src/lib/samples';
import { validateSkillOutput } from '../src/lib/guardrails';
import { readFrontmatterDescription, readFrontmatterName, slugify } from '../src/lib/skill';

/**
 * The samples are shown on the homepage as the "After" side and offered in the
 * demo. They must satisfy the same rules as a generated skill, otherwise the
 * site would advertise an output the generator cannot actually produce.
 */

test('ogni esempio produce una skill valida', () => {
  for (const s of SAMPLES) {
    const check = validateSkillOutput(s.skill);
    assert.equal(check.ok, true, `${s.id}: ${check.reason}`);
  }
});

test('ogni esempio ha frontmatter con nome e descrizione', () => {
  for (const s of SAMPLES) {
    assert.ok(readFrontmatterName(s.skill), `${s.id} senza name`);
    assert.ok(readFrontmatterDescription(s.skill), `${s.id} senza description`);
  }
});

test('ogni esempio ha il materiale grezzo e uno slug utilizzabile', () => {
  for (const s of SAMPLES) {
    assert.ok(s.raw.trim().length > 60, `${s.id}: materiale troppo corto per la demo`);
    assert.equal(slugify(s.id), s.id, `${s.id}: lo slug deve restare stabile`);
  }
});

test('l esempio predefinito e il primo della lista', () => {
  assert.equal(DEFAULT_SAMPLE, SAMPLES[0]);
});

test('nessun esempio inventa contenuti: la sezione mancante e presente', () => {
  for (const s of SAMPLES) {
    assert.match(s.skill, /## Missing information/, `${s.id} senza sezione delle informazioni mancanti`);
  }
});
