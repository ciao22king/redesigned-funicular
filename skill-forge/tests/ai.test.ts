import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTEMPT_TIMEOUT_MS, MODELS, REASONING_EFFORT, SYSTEM_PROMPT } from '../src/lib/ai';

test('la scala dei modelli non e vuota', () => {
  assert.ok(MODELS.length > 0);
});

test('il primo modello e il piu piccolo, per rispondere subito', () => {
  assert.equal(MODELS[0], 'liquid/lfm-2.5-2.6b:free');
});

test('il modello piu grande resta come ultima spiaggia', () => {
  assert.equal(MODELS[MODELS.length - 1], 'nvidia/nemotron-3-ultra-550b-a55b:free');
});

test('nessun modello e ripetuto', () => {
  assert.equal(new Set(MODELS).size, MODELS.length);
});

test('l effort di ragionamento non e mai "none", che alcuni modelli rifiutano', () => {
  // liquid/lfm-2.5-2.6b and recursive/flint-v1.0 declare reasoning as mandatory
  // and reject effort "none": the request would fail for them.
  assert.notEqual(REASONING_EFFORT, 'none');
});

test('il timeout per tentativo e positivo e sotto il budget della funzione', () => {
  assert.ok(ATTEMPT_TIMEOUT_MS > 0);
  assert.ok(ATTEMPT_TIMEOUT_MS < 60_000);
});

test('il system prompt impone la struttura della skill', () => {
  for (const section of [
    '## When to use it',
    '## When NOT to use it',
    '## Procedure',
    '## Rules and constraints',
    '## Final checklist',
  ]) {
    assert.ok(SYSTEM_PROMPT.includes(section), `manca ${section}`);
  }
});

test('il system prompt impone l inglese', () => {
  assert.match(SYSTEM_PROMPT, /Write the skill in English, always/);
});
