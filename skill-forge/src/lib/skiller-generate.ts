/**
 * The generator, on the device.
 *
 * It runs the same pipeline as the server: the same system prompt, the same
 * user prompt, the same deterministic normalisation and the same validation. If
 * it produced a different document shape, "generate on your device" would be a
 * different product; this way the only difference is which model runs it.
 *
 * What it cannot do is the server's fallback ladder: there is one model here, so
 * a failure is reported instead of retried elsewhere. The self-review pass is
 * skipped too, because on a model this size it costs more quality than it adds.
 *
 * The input is fitted to the context window before it is sent. That is not an
 * optimisation: the server cap is larger than the window, so without it a long
 * paste would overflow and the reply would be generated from material the model
 * never saw.
 */
import { getEngine, type ProgressFn, type SkillerEngine } from './skiller-engine';
import { buildUserPrompt, SYSTEM_PROMPT, type GenerateBody } from './prompt';
import { GUARDRAIL_PROMPT, validateSkillOutput } from './guardrails';
import { normalizeSkill } from './normalize';
import { stripFences } from './skill';
import { RETRY_MESSAGE } from './messages';
import { SKILLER_CONTEXT_WINDOW, SKILLER_MODEL_ID, SKILLER_REPLY_TOKENS } from './skiller';

/**
 * Tokens the fixed part of the request costs: the system prompt, the guardrails
 * and the user-prompt scaffolding (audience, tone, the `<source_material>`
 * tags). The scaffolding is measured by building the prompt with empty
 * material, so it tracks edits to `prompt.ts` instead of being guessed. English
 * prose runs at about four characters per token, rounded up.
 */
const PROMPT_OVERHEAD_TOKENS = Math.ceil(
  (SYSTEM_PROMPT.length +
    GUARDRAIL_PROMPT.length +
    buildUserPrompt({ mode: 'from-skills', sourceMaterial: '' }).length) /
    4,
);

/**
 * Characters of source material the device can actually read.
 *
 * This is the fix for a silent failure: the server accepts 20000 characters,
 * but the context window is 4096 tokens. Sent whole, the material alone would
 * fill the window, and the engine would either reject the request or generate
 * from a truncated source without saying so. The cap is derived from the window
 * minus everything else that shares it, so it tracks any change to the window,
 * the prompt or the reply reserve instead of drifting.
 */
export const SKILLER_MAX_INPUT_CHARS =
  (SKILLER_CONTEXT_WINDOW - SKILLER_REPLY_TOKENS - PROMPT_OVERHEAD_TOKENS) * 4;

/** Output budget for the on-device model, from the shared reserve. */
export const SKILLER_OUTPUT_TOKENS = SKILLER_REPLY_TOKENS;

export interface SkillerGenerateOk {
  markdown: string;
  model: string;
  normalizations: string[];
  /** True when the material was longer than the window and had to be cut. */
  truncated: boolean;
}

export interface SkillerGenerateErr {
  error: string;
}

/**
 * Generates a skill in the browser.
 *
 * `onProgress` receives the engine's loading messages, so the UI can show the
 * download the first time. On a rejection the caller shows `error`, which is
 * already a sentence the user can act on.
 *
 * `loadEngine` is the seam the tests use: in the browser it defaults to the
 * shared singleton, and a test passes a stand-in that needs no GPU. Only the
 * engine is substituted; the prompt, normalisation and validation are the real
 * ones.
 */
export async function generateOnDevice(
  body: GenerateBody,
  onProgress?: ProgressFn,
  loadEngine: (onProgress?: ProgressFn) => Promise<SkillerEngine> = getEngine,
): Promise<SkillerGenerateOk | SkillerGenerateErr> {
  const engine = await loadEngine(onProgress);

  const { body: fitted, truncated } = fitToWindow(body);

  const reply = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + GUARDRAIL_PROMPT },
      { role: 'user', content: buildUserPrompt(fitted) },
    ],
    max_tokens: SKILLER_OUTPUT_TOKENS,
  });

  const raw = reply.choices[0]?.message.content ?? '';
  const normalized = normalizeSkill(stripFences(raw));

  if (normalized.unresolved.length > 0) {
    return { error: RETRY_MESSAGE };
  }

  const check = validateSkillOutput(normalized.markdown);
  if (!check.ok) {
    return { error: RETRY_MESSAGE };
  }

  return {
    markdown: normalized.markdown,
    model: SKILLER_MODEL_ID,
    normalizations: normalized.applied,
    truncated,
  };
}

/**
 * Cuts the source material to what the window can hold, keeping the tail.
 *
 * The tail, not the head: pasted notes and transcripts put the conclusion and
 * the action items last, and that is where a skill's procedure comes from.
 * Returns the body unchanged when it already fits.
 */
export function fitToWindow(body: GenerateBody): { body: GenerateBody; truncated: boolean } {
  if (body.mode !== 'from-skills') return { body, truncated: false };

  const material = body.sourceMaterial ?? '';
  if (material.length <= SKILLER_MAX_INPUT_CHARS) return { body, truncated: false };

  return {
    body: { ...body, sourceMaterial: material.slice(-SKILLER_MAX_INPUT_CHARS) },
    truncated: true,
  };
}
