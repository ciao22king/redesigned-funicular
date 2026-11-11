/**
 * AI client on OpenRouter (OpenAI-compatible gateway).
 * Base URL: https://openrouter.ai/api/v1
 * Auth: Bearer sk-or-v1-...
 *
 * We call the REST API with the Workers native fetch instead of the OpenAI SDK:
 * on workerd the SDK picks the "node" runtime (node-fetch + agentkeepalive) and
 * http.Agent does not exist, so every call ends in "Connection error".
 * The key stays server-side only, never in the client bundle.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  usage: unknown;
  /**
   * Why the model stopped. `length` means the token budget ran out, which is
   * how a reasoning model reports having spent everything on thinking: without
   * it a truncated reply is indistinguishable from an empty one.
   */
  finishReason: string | null;
}

/** Timeout per attempt: a slow model must not block the request. */
export const ATTEMPT_TIMEOUT_MS = 25_000;

/**
 * Reasoning effort sent to OpenRouter. Every free model now reasons before
 * answering, and the reasoning tokens are charged against `max_tokens`: at the
 * default effort a model can spend almost the whole budget thinking and return
 * an empty completion (OpenRouter reports it as `status: incomplete`).
 * "medium" is accepted by every model in the ladder, including the ones that
 * declare reasoning as mandatory and reject "none". Override with
 * OPENROUTER_REASONING_EFFORT, or set it to "" to omit the field entirely.
 */
export const REASONING_EFFORT = (process.env.OPENROUTER_REASONING_EFFORT ?? 'medium').trim();

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  temperature = 0.4,
  maxTokens?: number,
  timeoutMs = ATTEMPT_TIMEOUT_MS,
): Promise<ChatResult> {
  const base = (process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

  // AbortController: if the model does not answer within the timeout, the request
  // is aborted and the generation moves to the next model instead of hanging
  // until the function limit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ''}`,
        // OpenRouter uses them to attribute the app in the dashboard.
        'HTTP-Referer':
          process.env.OPENROUTER_SITE_URL ?? 'https://github.com/ciao22king/redesigned-funicular',
        'X-Title': 'Skill Forge',
      },
      body: JSON.stringify({
        model,
        temperature,
        messages,
        // `sort: throughput` makes OpenRouter pick the provider that serves the
        // model with the lowest latency, instead of the default (price).
        provider: { sort: 'throughput', allow_fallbacks: true },
        // Keep the thinking short enough to leave room for the document inside
        // `max_tokens`. Omitted when the override is set to an empty string.
        ...(REASONING_EFFORT ? { reasoning: { effort: REASONING_EFFORT } } : {}),
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }
  clearTimeout(timer);

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: unknown;
  };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response: ${text.slice(0, 200)}`);
  }

  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content ?? '',
    usage: data.usage ?? null,
    finishReason: choice?.finish_reason ?? null,
  };
}

/**
 * Free OpenRouter models, from fastest to most capable.
 * The order is the main lever on latency: try the small model first, which
 * answers right away, and only move up in size if it fails.
 * The list can be replaced with OPENROUTER_MODELS (comma-separated ids)
 * without touching the code.
 */
export const MODELS: string[] = (
  process.env.OPENROUTER_MODELS ??
  [
    'liquid/lfm-2.5-2.6b:free', // the smallest: near-immediate answer
    'google/gemma-4-26b-a4b-it:free',
    'cohere/north-mini-code:free',
    'recursive/flint-v1.0:free',
    'nvidia/nemotron-3.5-lightning:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nvidia/nemotron-3.5-super-vl:free',
    'dots-studio/dots-3-note-preview:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free', // 550B, the most capable, last resort
  ].join(',')
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/** First model of the ladder: used as a label when the fallback does not start. */
export const MODEL = MODELS[0];

export const SYSTEM_PROMPT = `You are Skill Forge, an engine that turns raw material into complete skills for AI agents.

A "skill" is an operational Markdown document, written to be executed by an agent. It must contain verifiable instructions, not generic advice.

## Required output structure

ALWAYS produce a Markdown document with this exact structure, with no preamble and no commentary of your own:

---
name: <kebab-case-slug>
description: <one sentence, max 30 words, saying when to use the skill>
---

# <Skill title>

## When to use it
Explicit triggers: phrases, contexts, user requests that activate the skill.

## When NOT to use it
Edge cases, requests that look similar but belong to another skill.

## Prerequisites
Tools, access, knowledge required. If nothing is needed, write "None".

## Procedure
Numbered steps. Every step must be actionable and verifiable. No "consider doing...".

## Rules and constraints
What is mandatory, what is forbidden. Be blunt.

## Examples

### Input
<a realistic input>

### Expected output
<the correct, concrete output>

## Common mistakes
What agents typically get wrong on this task, and how to avoid it.

## Missing information
Facts you could not verify from the material. For each one, write the targeted
question whose answer would close it. If nothing is missing, write "None".

## Final checklist
- [ ] verifiable item
- [ ] verifiable item

## Writing rules
- Never invent facts, tools, version numbers or steps. If you do not know, list
  it under "Missing information" and ask, instead of guessing.
- No em dashes. Use commas, colons, parentheses.
- No filler words: "elevate", "seamless", "unleash", "delve", "robust" without substance.
- Every claim must be verifiable by the reader.
- Length: detailed enough to be executed with no external context. Do not shorten the procedure.
- Write the skill in English, always, whatever the language of the source material.`;


