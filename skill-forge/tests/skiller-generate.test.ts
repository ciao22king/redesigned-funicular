import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOnDevice } from '../src/lib/skiller-generate';
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
    assert.equal(out.model, 'skillforge-skiller-0.5B');
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
