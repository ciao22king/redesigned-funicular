/**
 * One WebLLM engine for the whole page.
 *
 * The chat and the generator both need the model, and loading it twice would
 * download the weights twice and hold two copies in VRAM. So the engine is a
 * module-level singleton: the first caller creates it, everyone else awaits the
 * same promise.
 *
 * The WebLLM package is imported dynamically here, and only here, so it stays
 * out of the initial bundle and out of the server build.
 */
import { SKILLER_MODEL_ID } from './skiller';
import { skillerEngineConfig, skillerModelRecord } from './skiller-webllm';

/** The slice of the WebLLM engine we use, kept minimal on purpose. */
export interface SkillerEngine {
  chat: {
    completions: {
      create: (req: {
        messages: { role: string; content: string }[];
        temperature?: number;
        top_p?: number;
        repetition_penalty?: number;
        max_tokens?: number;
      }) => Promise<{ choices: { message: { content: string } }[] }>;
    };
  };
}

export type ProgressFn = (text: string) => void;

let enginePromise: Promise<SkillerEngine> | null = null;

/**
 * Returns the shared engine, creating it on first use.
 *
 * A failed load clears the promise, so a retry after a transient error starts
 * over instead of replaying the rejection forever.
 */
export function getEngine(onProgress?: ProgressFn): Promise<SkillerEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const webllm = await import('@mlc-ai/web-llm');
      // The first argument is the model id; our card travels in `appConfig`,
      // which is how WebLLM is told about a model outside its own catalogue.
      const engine = await webllm.CreateMLCEngine(
        SKILLER_MODEL_ID,
        {
          appConfig: { model_list: [skillerModelRecord()] },
          initProgressCallback: (p) => onProgress?.(p.text ?? ''),
        },
        skillerEngineConfig(),
      );
      return engine as unknown as SkillerEngine;
    })().catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

/** True once the model is loaded and ready to answer. */
export function isEngineReady(): boolean {
  return enginePromise !== null;
}

/** Test seam: forget the cached engine. */
export function resetEngine(): void {
  enginePromise = null;
}
