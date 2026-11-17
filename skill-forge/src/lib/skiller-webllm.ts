/**
 * The WebLLM model card for `skillforge-skiller-0.5B`.
 *
 * WebLLM runs the model in the browser, on the phone's GPU: no server, no API
 * key, no per-token cost. It ships a catalogue of ready models; this module adds
 * ours to it.
 *
 * What "our model" means here: the weights are Qwen2.5-0.5B-Instruct fine-tuned
 * on the product's own (material -> skill) pairs, then quantized to MLC's
 * q4f16_1 format. The conversion is done by `skiller-training/mlc_export.py`,
 * which reproduces MLC's quantizer byte-for-byte, so only the weights differ
 * from the published build — the compiled WebGPU kernels are the same.
 *
 * The weights live in this repository, on the `models` branch, under
 * `resolve/main/`. The path is deliberate: WebLLM builds every artefact URL by
 * appending `resolve/main/` to `model` (its `cleanModelUrl`), the Hugging Face
 * layout. Serving them from GitHub's raw host keeps that layout and gets
 * `Access-Control-Allow-Origin: *` for free; a release asset, by contrast, sends
 * no CORS header and would not load in the page.
 *
 * The `.wasm` is upstream, not ours: a compiled model library depends only on
 * the architecture and the quantization, not on the weight values, so the
 * prebuilt Qwen2-0.5B library runs our fine-tuned weights unchanged.
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

/** Our fine-tuned weights, served from the `models` branch of this repository. */
const BASE_MODEL_URL =
  'https://raw.githubusercontent.com/ciao22king/redesigned-funicular/models/resolve/main';

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
    model_lib: `${MODEL_LIB_PREFIX}${MODEL_LIB_VERSION}/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    // The upstream figure for the 0.5B weights plus the KV cache at 4k. Ours is
    // the same: the fine-tune does not change the architecture.
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
    frequency_penalty: SKILLER_GENERATION.frequency_penalty,
    presence_penalty: SKILLER_GENERATION.presence_penalty,
  };
}

/** The system message, re-exported so the chat layer has one source. */
export const skillerSystemPrompt = SKILLER_SYSTEM_PROMPT;
