import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillerModelRecord, skillerEngineConfig, skillerSystemPrompt } from '../src/lib/skiller-webllm';
import { SKILLER_CONTEXT_WINDOW, SKILLER_MODEL_ID } from '../src/lib/skiller';

test('la card usa il nostro id, non quello di Qwen', () => {
  const rec = skillerModelRecord();
  assert.equal(rec.model_id, SKILLER_MODEL_ID);
  assert.equal(rec.model_id, 'skillforge-skiller-0.5B');
});

test('i pesi sono i nostri, sul branch models del repo', () => {
  const rec = skillerModelRecord();
  // Il percorso `resolve/main/` non è decorativo: WebLLM lo appende da sé
  // (`cleanModelUrl`), quindi la base deve fermarsi prima. Se cambia, il
  // browser chiede URL inesistenti.
  assert.equal(
    rec.model,
    'https://raw.githubusercontent.com/ciao22king/redesigned-funicular/models/resolve/main',
  );
  assert.ok(!rec.model.endsWith('/resolve/main/'));
});

test('il kernel wasm e\u2019 quello compilato per WebGPU', () => {
  const rec = skillerModelRecord();
  assert.match(rec.model_lib, /binary-mlc-llm-libs/);
  assert.ok(rec.model_lib.endsWith('Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm'));
});

test('il contesto e\u2019 ridotto per il telefono', () => {
  const rec = skillerModelRecord();
  assert.equal(rec.overrides.context_window_size, SKILLER_CONTEXT_WINDOW);
  assert.equal(rec.overrides.context_window_size, 4096);
  assert.equal(rec.low_resource_required, true);
  assert.ok(rec.vram_required_MB < 1800);
});

test('i parametri di generazione sono deterministici e prudenti', () => {
  const cfg = skillerEngineConfig();
  assert.equal(cfg.temperature, 0.3);
  assert.ok(cfg.top_p > 0 && cfg.top_p <= 1);
  assert.ok(cfg.repetition_penalty >= 1);
  // Anti-loop: the penalties are the difference between a document and a
  // paragraph repeated until the token budget runs out.
  assert.ok(cfg.frequency_penalty > 0);
  assert.ok(cfg.presence_penalty >= 0);
});

test('il prompt di sistema e\u2019 ri-esportato senza modifiche', () => {
  assert.ok(skillerSystemPrompt.includes('You are Skiller'));
  assert.ok(skillerSystemPrompt.includes('## Boundaries'));
});

test('la card e\u2019 ricostruita a ogni chiamata (nessuno stato condiviso)', () => {
  const a = skillerModelRecord();
  const b = skillerModelRecord();
  assert.notEqual(a, b);
  assert.deepEqual(a, b);
});
