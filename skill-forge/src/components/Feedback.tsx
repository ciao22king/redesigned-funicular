'use client';

import { useState } from 'react';
import { FEEDBACK_VERDICTS, VERDICT_LABELS, type FeedbackVerdict } from '@/lib/feedback';

/**
 * The feedback prompt shown right after a skill is generated.
 *
 * It appears once, is two fields long, and disappears after an answer: a long
 * form here would get no answers, and a form that keeps reappearing would be an
 * annoyance. The note is optional, so the verdict alone is a complete answer.
 */
export function Feedback({ mode }: { mode: string }) {
  const [verdict, setVerdict] = useState<FeedbackVerdict | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(choice: FeedbackVerdict, withNote = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: choice, note: withNote ? note : '', mode }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Could not send the feedback.');
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-[--line] bg-[--surface-sunken] px-4 py-3 text-sm text-[--ink-muted]">
        Thank you. This is what decides what gets built next.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[--line] bg-[--surface-raised] p-5">
      <p className="text-sm font-medium text-[--ink]">
        Was this skill useful? What is missing?
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {FEEDBACK_VERDICTS.map((v) => (
          <button
            key={v}
            type="button"
            disabled={busy}
            onClick={() => {
              setVerdict(v);
              if (v !== 'yes') return;
              void send(v);
            }}
            className={`rounded-lg border px-4 py-2 text-sm transition-colors disabled:opacity-50 ${
              verdict === v
                ? 'border-[--accent] bg-[--accent-soft] text-[--accent]'
                : 'border-[--line] bg-[--surface-raised] text-[--ink-muted] hover:text-[--ink]'
            }`}
          >
            {VERDICT_LABELS[v]}
          </button>
        ))}
      </div>

      {verdict && verdict !== 'yes' && (
        <div className="mt-3">
          <label className="mb-1 block text-xs text-[--ink-muted]">
            What would have made it useful? (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full resize-y rounded-lg border border-[--line] bg-[--surface-sunken] px-3 py-2 text-sm text-[--ink] outline-none focus:border-[--accent]"
            placeholder="A missing section, a wrong assumption, a detail that should be there."
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(verdict, true)}
            className="mt-2 rounded-lg bg-[--accent] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-[oklch(45%_0.14_28)]">{error}</p>}
    </div>
  );
}
