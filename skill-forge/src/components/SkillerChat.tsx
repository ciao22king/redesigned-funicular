'use client';

import { useCallback, useRef, useState } from 'react';
import {
  checkInput,
  checkOutput,
  MAX_REPLY_TOKENS,
  SKILLER_MODEL_ID,
  SKILLER_SYSTEM_PROMPT,
} from '@/lib/skiller';
import { skillerEngineConfig } from '@/lib/skiller-webllm';
import { getEngine } from '@/lib/skiller-engine';

/**
 * Skiller in the browser.
 *
 * The model runs on the device's GPU through WebLLM: no server, no API key, no
 * cost per token. The trade is the download — about a gigabyte the first
 * time, cached afterwards — so the engine is only imported when the user asks
 * for it, never on page load.
 *
 * The engine itself is the shared singleton from `skiller-engine`, so opening
 * this page after generating a skill reuses the model already in memory.
 *
 * The guardrails from `lib/skiller` run here, in the page: the input is checked
 * before the model sees it, the reply before it is shown. A small model can be
 * talked into echoing its instructions, and the echo is the leak.
 */

type Status = 'idle' | 'loading' | 'ready' | 'running' | 'error';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export function SkillerChat() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const readyRef = useRef(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      await getEngine((text) => setProgress(text));
      readyRef.current = true;
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(
        err instanceof Error
          ? `Could not load the model: ${err.message}`
          : 'Could not load the model.',
      );
    }
  }, []);

  const send = useCallback(async () => {
    if (!readyRef.current) return;

    const verdict = checkInput(input);
    if (!verdict.ok) {
      setError(verdict.reason ?? 'Input rejected.');
      return;
    }

    setError(null);
    setStatus('running');
    const userTurn: Turn = { role: 'user', content: verdict.text };
    const next = [...turns, userTurn];
    setTurns(next);
    setInput('');

    try {
      const engine = await getEngine();
      const cfg = skillerEngineConfig();
      const reply = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: SKILLER_SYSTEM_PROMPT },
          ...next.map((t) => ({ role: t.role, content: t.content })),
        ],
        ...cfg,
        max_tokens: MAX_REPLY_TOKENS,
      });
      const raw = reply.choices[0]?.message.content ?? '';
      const checked = checkOutput(raw);
      if (!checked.ok) {
        setError(checked.reason ?? 'The reply was withheld.');
      } else {
        setTurns([...next, { role: 'assistant', content: checked.text }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setStatus('ready');
    }
  }, [input, turns]);

  const busy = status === 'loading' || status === 'running';

  return (
    <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-[--ink]">Skiller, on your device</h2>
          <p className="mt-1 text-sm text-[--ink-muted]">
            {SKILLER_MODEL_ID} · runs in your browser, nothing is sent to a server.
          </p>
        </div>
        {status === 'idle' && (
          <button
            type="button"
            onClick={load}
            className="rounded-xl bg-[--accent] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Load the model
          </button>
        )}
      </div>

      {status === 'loading' && (
        <p className="mt-4 font-mono text-xs text-[--ink-muted]">{progress || 'Preparing…'}</p>
      )}
      {status === 'error' && error && (
        <p className="mt-4 rounded-lg border border-[--line] bg-[--surface-sunken] p-3 text-sm text-[--ink]">
          {error}
        </p>
      )}

      {status !== 'idle' && (
        <>
          <div className="mt-5 space-y-3">
            {turns.map((t, i) => (
              <div
                key={i}
                className={
                  t.role === 'user'
                    ? 'rounded-xl bg-[--surface-sunken] p-3 text-sm text-[--ink]'
                    : 'rounded-xl border border-[--line] p-3 text-sm text-[--ink]'
                }
              >
                <span className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
                  {t.role === 'user' ? 'You' : 'Skiller'}
                </span>
                <p className="mt-1 whitespace-pre-wrap">{t.content}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy) void send();
              }}
              disabled={busy}
              placeholder="Ask about a skill you want to build…"
              aria-label="Message to Skiller"
              className="flex-1 rounded-xl border border-[--line] bg-[--surface] px-4 py-3 text-sm text-[--ink]"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === 'running' ? '…' : 'Send'}
            </button>
          </div>
          {status === 'error' && error && (
            <p className="mt-2 text-sm text-[--ink-muted]" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
