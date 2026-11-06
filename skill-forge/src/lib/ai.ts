/**
 * Client AI su OpenRouter (gateway OpenAI-compatibile).
 * Base URL: https://openrouter.ai/api/v1
 * Auth: Bearer sk-or-v1-...
 *
 * Chiamiamo la REST API con la fetch nativa di Workers invece dell'SDK OpenAI:
 * su workerd l'SDK sceglie il runtime "node" (node-fetch + agentkeepalive) e
 * gli http.Agent non esistono, quindi ogni chiamata finisce in "Connection
 * error". La chiave resta solo lato server, mai nel bundle client.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  usage: unknown;
}

/** Timeout per singolo tentativo: un modello lento non deve bloccare la richiesta. */
export const ATTEMPT_TIMEOUT_MS = 25_000;

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  temperature = 0.4,
  maxTokens?: number,
  timeoutMs = ATTEMPT_TIMEOUT_MS,
): Promise<ChatResult> {
  const base = (process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

  // AbortController: se il modello non risponde entro il timeout, la richiesta
  // si annulla e la generazione passa al modello successivo invece di restare
  // appesa fino al limite della funzione.
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
        // OpenRouter li usa per attribuire l'app nella dashboard.
        'HTTP-Referer':
          process.env.OPENROUTER_SITE_URL ?? 'https://github.com/ciao22king/redesigned-funicular',
        'X-Title': 'Skill Forge',
      },
      body: JSON.stringify({
        model,
        temperature,
        messages,
        // `sort: throughput` fa scegliere a OpenRouter il provider che serve il
        // modello con la latenza piu' bassa, invece del default (prezzo).
        provider: { sort: 'throughput', allow_fallbacks: true },
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`timeout dopo ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }
  clearTimeout(timer);

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: { choices?: { message?: { content?: string } }[]; usage?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`risposta non JSON: ${text.slice(0, 200)}`);
  }

  return {
    content: data.choices?.[0]?.message?.content ?? '',
    usage: data.usage ?? null,
  };
}

/**
 * Modelli free di OpenRouter, dal piu' veloce al piu' capace.
 * L'ordine e' la leva principale sulla latenza: si prova prima il modello
 * piccolo, che risponde subito, e solo se fallisce si sale di dimensione.
 * La lista si puo' sostituire con OPENROUTER_MODELS (id separati da virgola)
 * senza toccare il codice.
 */
export const MODELS: string[] = (
  process.env.OPENROUTER_MODELS ??
  [
    'liquid/lfm-2.5-2.6b:free', // il piu' piccolo: risposta quasi immediata
    'google/gemma-4-26b-a4b-it:free',
    'cohere/north-mini-code:free',
    'xingchen-agi/xing4.0-29b-a4b:free',
    'recursive/flint-v1.0:free',
    'nvidia/nemotron-3.5-lightning:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nvidia/nemotron-3.5-super-vl:free',
    'dots-studio/dots-3-note-preview:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free', // 550B, il piu' capace, ultima spiaggia
  ].join(',')
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/** Primo modello della scala: usato come etichetta quando il fallback non parte. */
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

## Final checklist
- [ ] verifiable item
- [ ] verifiable item

## Writing rules
- No em dashes. Use commas, colons, parentheses.
- No filler words: "elevate", "seamless", "unleash", "delve", "robust" without substance.
- Every claim must be verifiable by the reader.
- Length: detailed enough to be executed with no external context. Do not shorten the procedure.
- Write the skill in English, always, whatever the language of the source material.`;


