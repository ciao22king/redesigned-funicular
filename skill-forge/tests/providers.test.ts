import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeProviders, allModels, groqModels, openrouterModels, PROVIDERS } from '../src/lib/providers';

/**
 * The provider table decides which models the fallback may use. These tests fix
 * the rule that matters: a provider is in the ladder only when its key is set,
 * and Groq is tried before OpenRouter.
 */
function withKeys(keys: Record<string, string | undefined>, run: () => void) {
  const saved = { ...process.env };
  for (const [k, v] of Object.entries(keys)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    run();
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

test('senza chiavi non c e nessun provider attivo', () => {
  withKeys({ GROQ_API_KEY: undefined, OPENROUTER_API_KEY: undefined }, () => {
    assert.equal(activeProviders().length, 0);
    assert.deepEqual(allModels(), []);
  });
});

test('con la sola chiave Groq la scala e solo Groq', () => {
  withKeys({ GROQ_API_KEY: 'gsk_test', OPENROUTER_API_KEY: undefined }, () => {
    const ladder = allModels();
    assert.ok(ladder.length > 0);
    assert.ok(ladder.every((m) => m.provider.id === 'groq'));
    assert.deepEqual(
      ladder.map((m) => m.model),
      groqModels(),
    );
  });
});

test('con entrambe le chiavi Groq viene prima di OpenRouter', () => {
  withKeys({ GROQ_API_KEY: 'gsk_test', OPENROUTER_API_KEY: 'sk-or-test' }, () => {
    const ids = allModels().map((m) => m.provider.id);
    assert.equal(ids[0], 'groq');
    assert.ok(ids.includes('openrouter'));
    // Ogni modello Groq precede ogni modello OpenRouter.
    assert.equal(ids.lastIndexOf('groq') < ids.indexOf('openrouter'), true);
  });
});

test('una chiave vuota o di soli spazi non attiva il provider', () => {
  withKeys({ GROQ_API_KEY: '   ', OPENROUTER_API_KEY: undefined }, () => {
    assert.equal(activeProviders().length, 0);
  });
});

test('la scala OpenRouter conserva l ordine piccolo-prima', () => {
  const models = openrouterModels();
  assert.equal(models[0], 'liquid/lfm-2.5-2.6b:free');
  assert.equal(models[models.length - 1], 'nvidia/nemotron-3-ultra-550b-a55b:free');
});

test('ogni provider dichiara il campo del tetto di token giusto', () => {
  const groq = PROVIDERS.find((p) => p.id === 'groq')!;
  const openrouter = PROVIDERS.find((p) => p.id === 'openrouter')!;
  // Groq depreca max_tokens in favore di max_completion_tokens.
  assert.equal(groq.maxTokensField, 'max_completion_tokens');
  assert.equal(openrouter.maxTokensField, 'max_tokens');
});

test('solo OpenRouter riceve il routing e il reasoning nel body', () => {
  const groq = PROVIDERS.find((p) => p.id === 'groq')!;
  const openrouter = PROVIDERS.find((p) => p.id === 'openrouter')!;
  assert.equal(groq.extraBody().provider, undefined);
  assert.equal((openrouter.extraBody().provider as { sort: string }).sort, 'throughput');
});
