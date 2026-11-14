/**
 * AI client over any OpenAI-compatible gateway (Groq, OpenRouter).
 *
 * The provider is passed in, not baked in: see `providers.ts` for the table of
 * base URLs, keys and model ladders. Here we only speak the protocol.
 *
 * We call the REST API with the Workers native fetch instead of an SDK: on
 * workerd the OpenAI SDK picks the "node" runtime (node-fetch + agentkeepalive)
 * and http.Agent does not exist, so every call ends in "Connection error".
 * The keys stay server-side only, never in the client bundle.
 */
import type { Provider } from './providers';

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

export { REASONING_EFFORT } from './providers';

export async function chatCompletion(
  provider: Provider,
  model: string,
  messages: ChatMessage[],
  temperature = 0.4,
  maxTokens?: number,
  timeoutMs = ATTEMPT_TIMEOUT_MS,
): Promise<ChatResult> {
  // AbortController: if the model does not answer within the timeout, the request
  // is aborted and the generation moves to the next model instead of hanging
  // until the function limit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model,
    temperature,
    messages,
    ...provider.extraBody(),
    // The cap field differs per provider (Groq deprecates `max_tokens`).
    ...(maxTokens ? { [provider.maxTokensField]: maxTokens } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey() ?? ''}`,
        ...provider.headers(),
      },
      body: JSON.stringify(body),
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
 * The model ladder now lives in `providers.ts`, together with Groq. Re-exported
 * here so existing imports keep working.
 */
export { MODELS, MODEL } from './providers';

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


