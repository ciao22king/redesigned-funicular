/**
 * The WebLLM model card for `skillforge-skiller-1.5B`.
 *
 * WebLLM runs the model in the browser, on the phone's GPU: no server, no API
 * key, no per-token cost. It ships a catalogue of ready models; this module adds
 * ours to it.
 *
 * What "our model" means here, stated plainly: the weights are the upstream MLC
 * build of Qwen2.5-1.5B-Instruct (quantized q4f16_1). Those weights are already
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
  SKILLER_CONTEXT_WINDOW,
  SKILLER_GENERATION,
  SKILLER_MODEL_ID,
  SKILLER_SYSTEM_PROMPT,
} from './skiller';

/** Where WebLLM keeps the compiled WebGPU kernels, per its own catalogue. */
const MODEL_LIB_PREFIX =
  'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/';
const MODEL_LIB_VERSION = 'v0_2_87/base';

/** The upstream MLC weights, as published by mlc-ai. */
const BASE_MODEL_URL = 'https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

/**
 * The context we ask for, shared with the generator so the input cap it derives
 * and the window the engine actually gets are the same number.
 */
const CONTEXT_WINDOW_SIZE = SKILLER_CONTEXT_WINDOW;

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
    model_lib: `${MODEL_LIB_PREFIX}${MODEL_LIB_VERSION}/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    // The upstream figure for the 1.5B weights plus the KV cache at 4k.
    vram_required_MB: 1629.75,
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
    frequency_penalty: SKILLER_GENERATION.frequency_penalty,
    presence_penalty: SKILLER_GENERATION.presence_penalty,
  };
}

/** The system message, re-exported so the chat layer has one source. */
export const skillerSystemPrompt = SKILLER_SYSTEM_PROMPT;
