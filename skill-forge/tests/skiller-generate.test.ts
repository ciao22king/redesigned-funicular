import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOnDevice, fitToWindow, SKILLER_MAX_INPUT_CHARS, SKILLER_OUTPUT_TOKENS } from '../src/lib/skiller-generate';
import { SKILLER_CONTEXT_WINDOW } from '../src/lib/skiller';
import type { SkillerEngine } from '../src/lib/skiller-engine';

/**
 * The on-device generator runs against WebLLM, which needs a browser and a GPU.
 * Neither exists in Node, so the engine is the one substituted: a stand-in
 * returns a scripted completion and records the request it received.
 *
 * Everything downstream of the engine is the real code — the shared prompt, the
 * normalisation and the validation — so a regression there fails these tests.
 */
function fakeEngine(
  content: string,
  seen?: { messages?: { role: string; content: string }[] },
): SkillerEngine {
  return {
    chat: {
      completions: {
        create: async (req) => {
          if (seen) seen.messages = req.messages;
          return { choices: [{ message: { content } }] };
        },
      },
    },
  };
}

/** A minimal valid skill document: the sections `normalizeSkill` requires. */
const VALID_SKILL = `---
name: demo-skill
description: A demo skill used by the tests.
---

# Demo skill

## When to use it
When the user asks for a demo.

## When NOT to use it
Never, outside the tests.

## Prerequisites
None.

## Procedure
1. Run the demo.
2. Check the output.
3. Report the result.

## Rules and constraints
Keep it short.

## Examples

### Input
demo

### Expected output
done

## Common mistakes
Skipping step 1.

## Missing information
None.

## Final checklist
- [ ] the demo ran
- [ ] the output was checked
`;

const BODY = { mode: 'from-scratch' as const, name: 'Demo', domain: 'testing', goal: 'demonstrate' };

test('genera una skill valida dal modello on-device', async () => {
  const out = await generateOnDevice(BODY, undefined, async () => fakeEngine(VALID_SKILL));
  assert.ok('markdown' in out, `atteso successo, ottenuto: ${JSON.stringify(out)}`);
  if ('markdown' in out) {
    assert.match(out.markdown, /# Demo skill/);
    assert.equal(out.model, 'skillforge-skiller-1.5B');
    assert.ok(Array.isArray(out.normalizations));
  }
});

test('un output senza le sezioni essenziali e un errore, non una skill rotta', async () => {
  const out = await generateOnDevice(BODY, undefined, async () => fakeEngine('Ciao, come stai?'));
  assert.ok('error' in out, 'un output non valido deve produrre un errore');
});

test('usa il system prompt del generatore piu i guardrail', async () => {
  const seen: { messages?: { role: string; content: string }[] } = {};
  await generateOnDevice(BODY, undefined, async () => fakeEngine(VALID_SKILL, seen));
  assert.ok(seen.messages);
  assert.equal(seen.messages[0].role, 'system');
  assert.match(seen.messages[0].content, /You are Skill Forge/);
  assert.equal(seen.messages[1].role, 'user');
  assert.match(seen.messages[1].content, /Demo/);
});

test('un errore del motore si propaga al chiamante', async () => {
  await assert.rejects(
    () =>
      generateOnDevice(BODY, undefined, async () => {
        throw new Error('no GPU');
      }),
    /no GPU/,
  );
});

test('il budget di input entra davvero nella finestra di contesto', () => {
  // The regression this pins: the input cap was inherited from the server
  // (20000 chars) while the window is 4096 tokens, so a long paste overflowed
  // and the reply came from material the model never saw.
  const budgetChars = SKILLER_MAX_INPUT_CHARS;
  const inputTokens = Math.ceil(budgetChars / 4);
  assert.ok(inputTokens < SKILLER_CONTEXT_WINDOW, 'input must fit in the window');
  assert.ok(
    inputTokens + SKILLER_OUTPUT_TOKENS < SKILLER_CONTEXT_WINDOW,
    'input plus reply must fit in the window',
  );
});

test('il materiale corto passa intatto', () => {
  const short = 'a few notes';
  const { body, truncated } = fitToWindow({ ...BODY, mode: 'from-skills', sourceMaterial: short });
  assert.equal(truncated, false);
  assert.equal(body.sourceMaterial, short);
});

test('il materiale lungo viene tagliato, e la coda e\u2019 quella che resta', () => {
  const head = 'HEAD '.repeat(3000);
  const tail = 'TAIL-ACTION-ITEM';
  const long = head + tail;
  const { body, truncated } = fitToWindow({ ...BODY, mode: 'from-skills', sourceMaterial: long });
  assert.equal(truncated, true);
  assert.equal(body.sourceMaterial!.length, SKILLER_MAX_INPUT_CHARS);
  // The conclusion and the action items are at the end of pasted notes, so the
  // tail is the part worth keeping.
  assert.ok(body.sourceMaterial!.endsWith(tail));
});

test('la modalita\u2019 from-scratch non viene toccata', () => {
  const { body, truncated } = fitToWindow(BODY);
  assert.equal(truncated, false);
  assert.equal(body, BODY);
});

test('la generazione segnala il troncamento all\u2019interfaccia', async () => {
  const out = await generateOnDevice(
    { ...BODY, mode: 'from-skills', sourceMaterial: 'x'.repeat(SKILLER_MAX_INPUT_CHARS + 500) },
    undefined,
    async () => fakeEngine(VALID_SKILL),
  );
  assert.ok('markdown' in out);
  if ('markdown' in out) assert.equal(out.truncated, true);
});
