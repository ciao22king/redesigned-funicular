/**
 * LLM providers behind one shape.
 *
 * Groq and OpenRouter both speak the OpenAI chat-completions protocol, so a
 * single client drives them: only the base URL, the key, the model ladder and a
 * couple of request fields differ. Keeping them in a table means the fallback
 * loop never learns their names.
 *
 * A provider counts as active only when its key is set: an unset key drops it
 * from the ladder instead of failing the request. With both keys set the ladder
 * is Groq then OpenRouter, so a Groq outage still answers through OpenRouter.
 */

export type ProviderId = 'groq' | 'openrouter';

export interface Provider {
  id: ProviderId;
  /** Name shown in errors and metrics. */
  label: string;
  baseUrl: string;
  /** Read at call time, never at import time: the key is a runtime secret. */
  apiKey: () => string | undefined;
  /** Models to try, fastest first. */
  models: () => string[];
  /** Extra headers the provider wants on every request. */
  headers: () => Record<string, string>;
  /**
   * Which field carries the output cap. Groq deprecates `max_tokens` in favour
   * of `max_completion_tokens`; OpenRouter takes `max_tokens`.
   */
  maxTokensField: 'max_tokens' | 'max_completion_tokens';
  /** Provider-specific request fields (routing, reasoning). */
  extraBody: () => Record<string, unknown>;
}

function commaList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Groq's free tier, fastest first. gpt-oss answers with an explicit reasoning
 * chain but Groq bills reasoning apart from the answer and allows a 65k
 * completion, so the thinking cannot eat the document the way it did on
 * OpenRouter. llama-3.3-70b does not reason at all: it is the reliable fallback.
 */
export function groqModels(): string[] {
  return commaList(process.env.GROQ_MODELS).length
    ? commaList(process.env.GROQ_MODELS)
    : [
        'openai/gpt-oss-20b', // ~1000 t/s, the quickest to answer
        'openai/gpt-oss-120b', // ~500 t/s, the most capable model Groq serves
        'llama-3.3-70b-versatile', // no reasoning: a plain, dependable last resort
      ];
}

/**
 * Free OpenRouter models, fastest first. The order is the main lever on
 * latency: try the small model first, which answers right away, and only move
 * up in size if it fails. Override with OPENROUTER_MODELS (comma-separated).
 */
export function openrouterModels(): string[] {
  return commaList(process.env.OPENROUTER_MODELS).length
    ? commaList(process.env.OPENROUTER_MODELS)
    : [
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
      ];
}

/**
 * Reasoning effort for OpenRouter. Every free model now reasons before
 * answering, and there the reasoning tokens are charged against `max_tokens`:
 * at the default effort a model can spend the whole budget thinking and return
 * an empty completion (OpenRouter reports it as `status: incomplete`).
 * "medium" is accepted by every model in the ladder, including the ones that
 * declare reasoning as mandatory and reject "none". Override with
 * OPENROUTER_REASONING_EFFORT, or set it to "" to omit the field entirely.
 */
export const REASONING_EFFORT = (process.env.OPENROUTER_REASONING_EFFORT ?? 'medium').trim();

export const PROVIDERS: Provider[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: () => process.env.GROQ_API_KEY,
    models: groqModels,
    headers: () => ({}),
    maxTokensField: 'max_completion_tokens',
    extraBody: () => {
      // Left unset by default: Groq separates reasoning from the answer, so
      // there is nothing to hold back. Set GROQ_REASONING_EFFORT to tune it.
      const effort = (process.env.GROQ_REASONING_EFFORT ?? '').trim();
      return effort ? { reasoning_effort: effort } : {};
    },
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: (process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
    apiKey: () => process.env.OPENROUTER_API_KEY,
    models: openrouterModels,
    headers: () => ({
      // OpenRouter uses them to attribute the app in the dashboard.
      'HTTP-Referer':
        process.env.OPENROUTER_SITE_URL ?? 'https://github.com/ciao22king/redesigned-funicular',
      'X-Title': 'Skill Forge',
    }),
    maxTokensField: 'max_tokens',
    extraBody: () => ({
      // `sort: throughput` makes OpenRouter pick the provider that serves the
      // model with the lowest latency, instead of the default (price).
      provider: { sort: 'throughput', allow_fallbacks: true },
      ...(REASONING_EFFORT ? { reasoning: { effort: REASONING_EFFORT } } : {}),
    }),
  },
];

/** The providers that have a key, in ladder order. */
export function activeProviders(): Provider[] {
  return PROVIDERS.filter((p) => (p.apiKey() ?? '').trim().length > 0);
}

/**
 * OpenRouter ladder as a plain list, kept as a named export for callers that
 * only ever cared about OpenRouter. New code should walk `allModels()`.
 */
export const MODELS: string[] = openrouterModels();

/** First model of the OpenRouter ladder. */
export const MODEL = MODELS[0];

export interface ActiveModel {
  provider: Provider;
  model: string;
}

/** Every (provider, model) pair to try, in order: the ladder the loop walks. */
export function allModels(): ActiveModel[] {
  const out: ActiveModel[] = [];
  for (const provider of activeProviders()) {
    for (const model of provider.models()) out.push({ provider, model });
  }
  return out;
}
