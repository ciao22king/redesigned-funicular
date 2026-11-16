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
 * skipped too, because on a 0.5B model it costs more quality than it adds.
 */
import { getEngine, type ProgressFn, type SkillerEngine } from './skiller-engine';
import { buildUserPrompt, SYSTEM_PROMPT, type GenerateBody } from './prompt';
import { GUARDRAIL_PROMPT, validateSkillOutput } from './guardrails';
import { normalizeSkill } from './normalize';
import { stripFences } from './skill';
import { RETRY_MESSAGE } from './messages';

/**
 * Output budget for the on-device model. It is far below the server's 8000:
 * the context window is 4096 and a phone generates slowly, so a large budget
 * would only make the wait longer without producing a complete document.
 */
export const SKILLER_OUTPUT_TOKENS = 2_400;

export interface SkillerGenerateOk {
  markdown: string;
  model: string;
  normalizations: string[];
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

  const reply = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + GUARDRAIL_PROMPT },
      { role: 'user', content: buildUserPrompt(body) },
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
    model: 'skillforge-skiller-0.5B',
    normalizations: normalized.applied,
  };
}
