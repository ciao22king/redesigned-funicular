'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Report } from '@/components/Report';
import { track } from '@/lib/track';

interface SkillActionsProps {
  skillId: string;
  name: string;
  slug: string;
  owner: string;
  markdown: string;
}

/**
 * The action bar of a skill page: copy, download, fork and report.
 *
 * Copy and download both hand over the same markdown but are counted
 * differently. The download goes through the API route (the server observes it
 * and records `download`); the copy happens in the browser, so it reports
 * `copy` itself — the only outcome event a client is trusted with, because it
 * is the only one a client can honestly observe, and inflating it changes no
 * ranking.
 */
export function SkillActions({ skillId, name, slug, owner, markdown }: SkillActionsProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      track('copy', { target: skillId });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/api/marketplace/detail?id=${encodeURIComponent(skillId)}`}
        className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Download .md
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
      >
        {copied ? 'Copied' : 'Copy Markdown'}
      </button>
      <Link
        href={`/create/from-skills?fork=${encodeURIComponent(skillId)}`}
        className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
        title={`Start a new skill from "${name}"`}
      >
        Fork
      </Link>
      <Report skillId={skillId} />
      <span className="sr-only">
        Skill {slug} by {owner}
      </span>
    </div>
  );
}
