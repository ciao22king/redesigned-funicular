import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUserPrompt as fromGenerate } from '../src/lib/generate';
import { SYSTEM_PROMPT as systemFromAi } from '../src/lib/ai';
import { buildUserPrompt as fromPrompt, SYSTEM_PROMPT as systemFromPrompt } from '../src/lib/prompt';

/**
 * The on-device model and the server must build the same prompt and use the same
 * system prompt. If they drifted, "generate on your device" would silently be a
 * different product, so this pins the two modules together.
 */
const BODY = {
  mode: 'from-skills' as const,
  sourceMaterial: 'Step 1: open the editor.\nStep 2: save the file.',
  audience: 'generic-agent',
  register: 'technical',
};

test('il prompt del device e quello del server sono identici (from-skills)', () => {
  assert.equal(fromPrompt(BODY), fromGenerate(BODY));
});

test('il prompt del device e quello del server sono identici (from-scratch)', () => {
  const scratch = {
    mode: 'from-scratch' as const,
    name: 'Deploy checklist',
    domain: 'release engineering',
    goal: 'ship without breaking production',
  };
  assert.equal(fromPrompt(scratch), fromGenerate(scratch));
});

test('il system prompt e lo stesso oggetto in entrambi i moduli', () => {
  assert.equal(systemFromPrompt, systemFromAi);
});

test('il prompt include l audience e il tono scelti', () => {
  const prompt = fromPrompt(BODY);
  assert.match(prompt, /## Audience/);
  assert.match(prompt, /## Tone/);
});
