'use client';

import { CreateMLCEngine, type MLCEngineInterface } from '@mlc-ai/web-llm';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  onProgress?: (progress: number) => void;
  onToken?: (token: string) => void;
}

const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
const MODEL_LABEL = 'skiller-0.5B';

let enginePromise: Promise<MLCEngineInterface> | null = null;
let engine: MLCEngineInterface | null = null;
let initError: Error | null = null;

export function getModelLabel(): string {
  return MODEL_LABEL;
}

export function getModelId(): string {
  return MODEL_ID;
}

export function isEngineReady(): boolean {
  return engine !== null;
}

export function getInitError(): Error | null {
  return initError;
}

export async function initializeEngine(
  onProgress?: (report: { progress: number; text: string }) => void
): Promise<MLCEngineInterface> {
  if (engine) return engine;
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    try {
      const selectedEngine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          onProgress?.({
            progress: report.progress,
            text: report.text,
          });
        },
      });
      engine = selectedEngine;
      initError = null;
      return engine;
    } catch (err) {
      initError = err instanceof Error ? err : new Error('Unknown error initializing WebLLM');
      enginePromise = null;
      throw initError;
    }
  })();

  return enginePromise;
}

export async function generateChat(
  messages: ChatMessage[],
  options: GenerationOptions = {}
): Promise<string> {
  const eng = await initializeEngine();
  const { temperature = 0.4, maxTokens = 2048, onToken } = options;

  const reply = await eng.chat.completions.create({
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  let fullContent = '';
  for await (const chunk of reply) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      fullContent += delta;
      onToken?.(delta);
    }
  }

  return fullContent;
}

export async function generateChatStream(
  messages: ChatMessage[],
  options: GenerationOptions = {}
): Promise<AsyncGenerator<string, string, unknown>> {
  const eng = await initializeEngine();
  const { temperature = 0.4, maxTokens = 2048 } = options;

  const reply = await eng.chat.completions.create({
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  async function* tokenGenerator() {
    let fullContent = '';
    for await (const chunk of reply) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        fullContent += delta;
        yield delta;
      }
    }
    return fullContent;
  }

  return tokenGenerator();
}

export function resetEngine(): void {
  engine = null;
  enginePromise = null;
  initError = null;
}