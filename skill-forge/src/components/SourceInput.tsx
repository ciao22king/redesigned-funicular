'use client';

import { useState } from 'react';

export interface FetchedSource {
  url: string;
  kind: string;
  text: string;
  chars: number;
  finalUrl?: string;
  truncated?: boolean;
}

/**
 * Add material from somewhere other than a file: a public URL, a GitHub
 * repository, a Google Doc. Notion is handled with an explicit message, because
 * it cannot be read without a token we do not hold.
 */
export function SourceInput({
  onAdd,
  disabled,
}: {
  onAdd: (source: FetchedSource) => void;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function fetchSource() {
    setBusy(true);
    setError(null);
    setNotice(null);

    // A bare host is the common case: normalise it so the request passes the
    // server-side absolute-URL check.
    let normalized = url.trim();
    if (normalized && !/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      });
      const data = (await res.json()) as {
        text?: string;
        kind?: string;
        error?: string;
        finalUrl?: string;
        truncated?: boolean;
        needsManual?: boolean;
      };

      if (!res.ok || !data.text) {
        if (data.needsManual) setNotice(data.error ?? 'That source must be pasted manually.');
        else setError(data.error ?? 'The source could not be read.');
        return;
      }

      onAdd({
        url: normalized,
        kind: data.kind ?? 'url',
        text: data.text,
        chars: data.text.length,
        finalUrl: data.finalUrl,
        truncated: data.truncated,
      });
      setUrl('');
      if (data.truncated) {
        setNotice('The source was long, so only the beginning was used.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-[--ink]">Or add a public source</span>
      <span className="mb-3 block text-sm text-[--ink-muted]">
        A public URL, a GitHub repository, a Google Doc shared with anyone.
      </span>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && url.trim()) {
              e.preventDefault();
              void fetchSource();
            }
          }}
          placeholder="github.com/owner/repo, docs.google.com/..., https://..."
          className="flex-1 rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink] outline-none transition-colors placeholder:text-[--ink-muted]/60 focus:border-[--accent]"
        />
        <button
          type="button"
          disabled={disabled || busy || !url.trim()}
          onClick={() => void fetchSource()}
          className="rounded-xl border border-[--accent] bg-[--accent-soft] px-5 py-3 text-sm font-medium text-[--accent] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Fetching...' : 'Add source'}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-[oklch(45%_0.14_28)]">{error}</p>
      )}
      {notice && (
        <p className="mt-2 text-sm text-[--ink-muted]">{notice}</p>
      )}
    </div>
  );
}
