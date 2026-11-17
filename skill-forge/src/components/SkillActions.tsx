'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Report } from '@/components/Report';
import { track } from '@/lib/track';
import { fetchSkillForDownload, saveMarkdownFile, SignInRequiredError } from '@/lib/skill-download';

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
 *
 * The download requires sign-in: the server answers 401 and this offers the
 * GitHub sign-in instead of a raw error. Copy and fork stay open, so a visitor
 * can still read a skill without an account.
 */
export function SkillActions({ skillId, name, slug, owner, markdown }: SkillActionsProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const skill = await fetchSkillForDownload(skillId);
      saveMarkdownFile(slug || skill.id.split('/')[1] || 'skill', skill.markdown);
    } catch (e) {
      if (e instanceof SignInRequiredError) {
        setError('Sign in with GitHub to download a skill.');
      } else {
        setError(e instanceof Error ? e.message : 'Download failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy}
          className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Preparing...' : 'Download .md'}
        </button>
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
      {error && (
        <p className="text-sm text-[--ink-muted]">
          {error}{' '}
          <button
            type="button"
            onClick={() => signIn('github')}
            className="text-[--accent] underline underline-offset-2"
          >
            Sign in with GitHub
          </button>
        </p>
      )}
    </div>
  );
}
