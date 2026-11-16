import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeProviders, allModels, groqModels, hostedProvidersEnabled, openrouterModels, PROVIDERS } from '../src/lib/providers';

/**
 * The provider table decides which models the fallback may use. These tests fix
 * the rule that matters: a provider is in the ladder only when its key is set,
 * Groq is tried before OpenRouter, and the whole ladder is off unless
 * `HOSTED_PROVIDERS=on`.
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

/** The ladder only exists when the switch is on: most tests need it on. */
const ON = { HOSTED_PROVIDERS: 'on' };

test('senza chiavi non c e nessun provider attivo', () => {
  withKeys({ ...ON, GROQ_API_KEY: undefined, OPENROUTER_API_KEY: undefined }, () => {
    assert.equal(activeProviders().length, 0);
    assert.deepEqual(allModels(), []);
  });
});

test('con la sola chiave Groq la scala e solo Groq', () => {
  withKeys({ ...ON, GROQ_API_KEY: 'gsk_test', OPENROUTER_API_KEY: undefined }, () => {
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
  withKeys({ ...ON, GROQ_API_KEY: 'gsk_test', OPENROUTER_API_KEY: 'sk-or-test' }, () => {
    const ids = allModels().map((m) => m.provider.id);
    assert.equal(ids[0], 'groq');
    assert.ok(ids.includes('openrouter'));
    // Ogni modello Groq precede ogni modello OpenRouter.
    assert.equal(ids.lastIndexOf('groq') < ids.indexOf('openrouter'), true);
  });
});

test('una chiave vuota o di soli spazi non attiva il provider', () => {
  withKeys({ ...ON, GROQ_API_KEY: '   ', OPENROUTER_API_KEY: undefined }, () => {
    assert.equal(activeProviders().length, 0);
  });
});

test('senza HOSTED_PROVIDERS la scala e vuota anche con le chiavi', () => {
  withKeys({ HOSTED_PROVIDERS: undefined, GROQ_API_KEY: 'gsk_test', OPENROUTER_API_KEY: 'sk-or-test' }, () => {
    assert.equal(hostedProvidersEnabled(), false);
    assert.equal(activeProviders().length, 0);
    assert.deepEqual(allModels(), []);
  });
});

test('HOSTED_PROVIDERS accetta solo "on" (case e spazi indifferenti)', () => {
  for (const value of ['on', 'ON', ' On ', 'on\n']) {
    withKeys({ HOSTED_PROVIDERS: value }, () => {
      assert.equal(hostedProvidersEnabled(), true, `doveva accettare: ${JSON.stringify(value)}`);
    });
  }
  for (const value of ['off', 'true', '1', 'yes', '', undefined]) {
    withKeys({ HOSTED_PROVIDERS: value }, () => {
      assert.equal(hostedProvidersEnabled(), false, `non doveva accettare: ${JSON.stringify(value)}`);
    });
  }
});

test('i provider restano definiti anche quando sono spenti (non rimossi)', () => {
  withKeys({ HOSTED_PROVIDERS: undefined, GROQ_API_KEY: 'gsk_test' }, () => {
    // La tabella c'e' ancora: si riaccende con una variabile, non con il codice.
    assert.equal(PROVIDERS.length, 2);
    assert.ok(PROVIDERS.some((p) => p.id === 'groq'));
    assert.ok(PROVIDERS.some((p) => p.id === 'openrouter'));
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
