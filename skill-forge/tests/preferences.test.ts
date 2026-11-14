import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, OPT_OUT_EFFECT, toPreferences } from '../src/lib/preferences';

test('senza riga si usano i valori predefiniti', () => {
  assert.deepEqual(toPreferences(null), { ...DEFAULT_PREFERENCES });
  assert.equal(DEFAULT_PREFERENCES.trainOptOut, false);
});

test('la riga con opt-out attivo viene letta', () => {
  const prefs = toPreferences({ login: 'u', train_opt_out: 1, updated_at: '2026-01-01T00:00:00Z' });
  assert.equal(prefs.trainOptOut, true);
  assert.equal(prefs.updatedAt, '2026-01-01T00:00:00Z');
});

test('la riga con opt-out spento viene letta', () => {
  assert.equal(toPreferences({ login: 'u', train_opt_out: 0, updated_at: 'x' }).trainOptOut, false);
});

test('la spiegazione dell opt-out e una frase concreta', () => {
  assert.ok(OPT_OUT_EFFECT.length > 40);
  assert.match(OPT_OUT_EFFECT, /evaluation|debugging/);
});
