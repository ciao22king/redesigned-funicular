import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatCompletion } from '../src/lib/ai';
import { PROVIDERS } from '../src/lib/providers';

// The provider is explicit now: these tests exercise the OpenRouter request
// shape, so they pass that provider and a throwaway key.
const openrouter = PROVIDERS.find((p) => p.id === 'openrouter')!;

/**
 * Replaces `fetch` to observe the outgoing request without touching the
 * network: here we care about the shape of the request and the timeout handling,
 * not the response of a real model.
 */
function stubFetch(handler: (url: string, init: RequestInit) => Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('chiede il provider piu veloce e invia i parametri', async () => {
  process.env.OPENROUTER_API_KEY = 'chiave-di-prova';
  let seen: { url: string; init: RequestInit } | undefined;

  const restore = stubFetch(async (url, init) => {
    seen = { url, init };
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 1 } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });

  try {
    const result = await chatCompletion(openrouter, 'un/modello:free', [{ role: 'user', content: 'x' }], 0.4, 100);
    assert.equal(result.content, 'ok');

    const body = JSON.parse(String(seen?.init.body));
    assert.equal(body.provider.sort, 'throughput', 'deve chiedere il provider piu veloce');
    assert.equal(body.provider.allow_fallbacks, true);
    assert.equal(body.max_tokens, 100);
    assert.equal(body.model, 'un/modello:free');
    assert.equal(
      body.reasoning.effort,
      'medium',
      'deve limitare il ragionamento, che consuma lo stesso budget dei token visibili',
    );

    const headers = seen?.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer chiave-di-prova');
    assert.ok(seen?.url.endsWith('/chat/completions'));
  } finally {
    restore();
  }
});

test('una risposta di errore diventa un errore con lo stato', async () => {
  const restore = stubFetch(async () => new Response('limite superato', { status: 429 }));
  try {
    await assert.rejects(() => chatCompletion(openrouter, 'un/modello:free', []), /HTTP 429/);
  } finally {
    restore();
  }
});

test('il motivo di stop viene riportato al chiamante', async () => {
  const restore = stubFetch(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'troncato' }, finish_reason: 'length' }],
          usage: { total_tokens: 3 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  );
  try {
    const result = await chatCompletion(openrouter, 'un/modello:free', [], 0.4, 100);
    assert.equal(result.finishReason, 'length');
  } finally {
    restore();
  }
});

test('verso Groq usa il campo del tetto di token e nessun routing', async () => {
  process.env.GROQ_API_KEY = 'gsk-di-prova';
  const groq = PROVIDERS.find((p) => p.id === 'groq')!;
  let seen: { url: string; init: RequestInit } | undefined;

  const restore = stubFetch(async (url, init) => {
    seen = { url, init };
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  try {
    await chatCompletion(groq, 'openai/gpt-oss-20b', [{ role: 'user', content: 'x' }], 0.4, 100);

    assert.ok(seen?.url.startsWith('https://api.groq.com/openai/v1/'), 'base URL Groq');
    const body = JSON.parse(String(seen?.init.body));
    // Groq depreca max_tokens: il cap va nel campo nuovo.
    assert.equal(body.max_completion_tokens, 100);
    assert.equal(body.max_tokens, undefined);
    // Il routing `provider` e il `reasoning` sono specifici di OpenRouter.
    assert.equal(body.provider, undefined);
    assert.equal(body.reasoning, undefined);

    const headers = seen?.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer gsk-di-prova');
    assert.equal(headers['X-Title'], undefined, 'gli header di OpenRouter non vanno a Groq');
  } finally {
    restore();
    delete process.env.GROQ_API_KEY;
  }
});

test('senza finish_reason il campo resta null', async () => {
  const restore = stubFetch(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
  try {
    const result = await chatCompletion(openrouter, 'un/modello:free', [], 0.4, 100);
    assert.equal(result.finishReason, null);
  } finally {
    restore();
  }
});

test('un modello lento viene interrotto dal timeout', async () => {
  // Simulates a model that does not answer: the fetch stays pending until the
  // abort signal interrupts it.
  const restore = stubFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
  );

  try {
    await assert.rejects(() => chatCompletion(openrouter, 'lento/modello:free', [], 0.4, 100, 50), /timeout/);
  } finally {
    restore();
  }
});
