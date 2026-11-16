/**
 * The WebLLM model card for `skillforge-skiller-0.5B`.
 *
 * WebLLM runs the model in the browser, on the phone's GPU: no server, no API
 * key, no per-token cost. It ships a catalogue of ready models; this module adds
 * ours to it.
 *
 * What "our model" means here, stated plainly: the weights are the upstream MLC
 * build of Qwen2.5-0.5B-Instruct (quantized q4f16_1). Those weights are already
 * compiled for WebGPU and cannot be retrained in place — no GPU, no MLC
 * toolchain. What we own, and what this file defines, is everything around them:
 * the identity, the system prompt (the guardrails), the generation settings and
 * the context budget. That is the part that changes behaviour, and it is the
 * part that ships.
 *
 * Reusing the upstream weights is also what keeps this practical: the browser
 * downloads them from Hugging Face directly, so the repository stores no
 * hundreds of megabytes of binary.
 */
import {
  SKILLER_GENERATION,
  SKILLER_MODEL_ID,
  SKILLER_SYSTEM_PROMPT,
} from './skiller';

/** Where WebLLM keeps the compiled WebGPU kernels, per its own catalogue. */
const MODEL_LIB_PREFIX =
  'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/';
const MODEL_LIB_VERSION = 'v0_2_87/base';

/** The upstream MLC weights, as published by mlc-ai. */
const BASE_MODEL_URL = 'https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

/**
 * The context we ask for. The base model declares 32768, but a phone has far
 * less VRAM: WebLLM's own entry for this model overrides it to 4096, and we
 * follow that, because a request the device cannot hold fails outright.
 */
const CONTEXT_WINDOW_SIZE = 4096;

/**
 * The card WebLLM needs, in the shape of its `ModelRecord`. Kept as a plain
 * object so it is unit-testable and so the UI can read the id and the label
 * without importing the engine.
 */
export interface SkillerModelRecord {
  model_id: string;
  model: string;
  model_lib: string;
  vram_required_MB: number;
  low_resource_required: boolean;
  overrides: { context_window_size: number };
}

export function skillerModelRecord(): SkillerModelRecord {
  return {
    model_id: SKILLER_MODEL_ID,
    model: BASE_MODEL_URL,
    model_lib: `${MODEL_LIB_PREFIX}${MODEL_LIB_VERSION}/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    // The upstream figure: the q4f16_1 weights plus the KV cache at 4k.
    vram_required_MB: 944.62,
    // Signals WebLLM to keep the prefill chunk small: the phone is the target.
    low_resource_required: true,
    overrides: { context_window_size: CONTEXT_WINDOW_SIZE },
  };
}

/**
 * The engine options: our prompt as the system message, and the sampling
 * settings from `skiller.ts`. Passing the prompt here, and not per message,
 * means it cannot be dropped by a caller that forgets it.
 */
export function skillerEngineConfig() {
  return {
    temperature: SKILLER_GENERATION.temperature,
    top_p: SKILLER_GENERATION.top_p,
    repetition_penalty: SKILLER_GENERATION.repetition_penalty,
  };
}

/** The system message, re-exported so the chat layer has one source. */
export const skillerSystemPrompt = SKILLER_SYSTEM_PROMPT;
