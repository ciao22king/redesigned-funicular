'use client';

import { useState } from 'react';

/**
 * Share controls for a public skill page.
 *
 * The links are plain anchors (X, Reddit, Hacker News) so they work without JS;
 * only the "copy link" needs the clipboard, and it degrades to a hint if the
 * clipboard is refused (insecure context or denied permission).
 */
export function Share({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const text = `${title} — a skill for AI agents, on Skill Forge`;
  const enc = encodeURIComponent;
  const targets = [
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: 'Reddit', href: `https://www.reddit.com/submit?title=${enc(text)}&url=${enc(url)}` },
    { label: 'Hacker News', href: `https://news.ycombinator.com/submitlink?t=${enc(text)}&u=${enc(url)}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[--ink-muted]">
        Share
      </span>
      {targets.map((t) => (
        <a
          key={t.label}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[--line] bg-[--surface-raised] px-3 py-1.5 text-xs font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
        >
          {t.label}
        </a>
      ))}
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-lg border border-[--line] bg-[--surface-raised] px-3 py-1.5 text-xs font-medium text-[--ink-muted] transition-colors hover:text-[--ink]"
      >
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  );
}
