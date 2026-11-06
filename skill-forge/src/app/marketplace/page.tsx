'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { saveLocalSkill } from '@/lib/localstore';

interface SkillSummary {
  id: string;
  owner: string;
  name: string;
  description: string;
  tags: string[];
  stars: number;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  skills?: SkillSummary[];
  total?: number;
  pages?: number;
  page?: number;
  error?: string;
}

type Sort = 'recent' | 'stars' | 'name';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'stars', label: 'Most starred' },
  { key: 'name', label: 'Name' },
];

export default function MarketplacePage() {
  const { data: session, status } = useSession();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { q: string; sort: Sort; page: number }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ sort: opts.sort, page: String(opts.page) });
        if (opts.q.trim()) params.set('q', opts.q.trim());
        const res = await fetch(`/api/marketplace?${params.toString()}`);
        const data = (await res.json()) as ListResponse;
        if (!res.ok) throw new Error(data.error ?? 'Loading failed');
        setSkills(data.skills ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        setPage(data.page ?? 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // The search starts when the user stops typing.
    const timer = setTimeout(() => void load({ q: query, sort, page: 1 }), 250);
    return () => clearTimeout(timer);
    // `page` deliberately excluded: page changes are handled by hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort, load]);

  async function toggleStar(skill: SkillSummary) {
    if (status !== 'authenticated') {
      setNotice('Sign in with GitHub to star a skill.');
      return;
    }
    setBusyId(skill.id);
    setNotice(null);
    try {
      const res = await fetch('/api/marketplace/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: skill.id }),
      });
      const data = (await res.json()) as { error?: string; starred?: boolean; stars?: number };
      if (!res.ok) throw new Error(data.error ?? 'Operation failed');
      setSkills((prev) =>
        prev.map((s) =>
          s.id === skill.id ? { ...s, starred: !!data.starred, stars: data.stars ?? s.stars } : s,
        ),
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  async function download(skill: SkillSummary) {
    setBusyId(skill.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/marketplace/detail?id=${encodeURIComponent(skill.id)}`);
      const data = (await res.json()) as {
        skill?: { markdown: string; name: string; description: string };
        error?: string;
      };
      if (!res.ok || !data.skill) throw new Error(data.error ?? 'Download failed');

      // The downloaded skill also enters the local archive.
      saveLocalSkill({
        markdown: data.skill.markdown,
        name: data.skill.name,
        description: data.skill.description,
        source: 'imported',
      });

      const blob = new Blob([data.skill.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${skill.id.split('/')[1]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice(`"${skill.name}" downloaded and saved locally.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-5xl px-6 py-14">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
              Marketplace
            </h1>
            <p className="mt-3 max-w-prose text-[15px] text-[--ink-muted]">
              Skills published by the community. Download them, star them, or
              publish your own from{' '}
              <Link href="/dashboard" className="text-[--accent] underline underline-offset-2">
                My creations
              </Link>
              .
            </p>
          </div>
          {status === 'authenticated' && (
            <Link
              href="/create/from-skills"
              className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Create a skill
            </Link>
          )}
        </header>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, description, tag or author..."
            aria-label="Search the marketplace"
            className="min-w-[240px] flex-1 rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink] outline-none transition-colors placeholder:text-[--ink-muted]/60 focus:border-[--accent]"
          />
          <div className="flex items-center gap-1 rounded-xl border border-[--line] bg-[--surface-raised] p-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  sort === s.key
                    ? 'bg-[--accent] text-white'
                    : 'text-[--ink-muted] hover:text-[--ink]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <p className="mt-5 rounded-xl border border-[--line] bg-[--surface-sunken] px-4 py-3 text-sm text-[--ink]">
            {notice}
          </p>
        )}

        {error && <p className="mt-5 text-sm text-[oklch(45%_0.14_28)]">{error}</p>}

        {loading ? (
          <p className="mt-12 text-[--ink-muted]">Loading...</p>
        ) : skills.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-[--line] bg-[--surface-raised] p-8 text-center">
            <p className="font-display text-lg font-semibold text-[--ink]">
              {query ? 'No results' : 'The marketplace is still empty'}
            </p>
            <p className="mt-2 text-sm text-[--ink-muted]">
              {query
                ? 'Try another term.'
                : 'Publish the first skill from your dashboard.'}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-8 text-xs uppercase tracking-wider text-[--ink-muted]">
              {total} {total === 1 ? 'skill' : 'skill'}
            </p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {skills.map((skill) => (
                <li key={skill.id} className="surface-card flex flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold leading-snug text-[--ink]">
                      {skill.name}
                    </h2>
                    <button
                      type="button"
                      disabled={busyId === skill.id}
                      onClick={() => void toggleStar(skill)}
                      aria-pressed={skill.starred}
                      aria-label={skill.starred ? 'Remove star' : 'Add star'}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                        skill.starred
                          ? 'border-[--accent] bg-[--accent-soft] text-[--accent]'
                          : 'border-[--line] text-[--ink-muted] hover:text-[--ink]'
                      }`}
                    >
                      <Star filled={skill.starred} />
                      {skill.stars}
                    </button>
                  </div>

                  {skill.description && (
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-[--ink-muted]">
                      {skill.description}
                    </p>
                  )}

                  {skill.tags.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {skill.tags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-full bg-[--surface-sunken] px-2.5 py-1 font-mono text-[11px] text-[--ink-muted]"
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-[--ink-muted]">@{skill.owner}</span>
                    <button
                      type="button"
                      disabled={busyId === skill.id}
                      onClick={() => void download(skill)}
                      className="shrink-0 rounded-lg border border-[--line] bg-[--surface-raised] px-3.5 py-2 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken] disabled:opacity-50"
                    >
                      Download .md
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => void load({ q: query, sort, page: page - 1 })}
                  className="rounded-lg border border-[--line] px-4 py-2 text-sm text-[--ink] transition-colors hover:bg-[--surface-sunken] disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-[--ink-muted]">
                  {page} / {pages}
                </span>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => void load({ q: query, sort, page: page + 1 })}
                  className="rounded-lg border border-[--line] px-4 py-2 text-sm text-[--ink] transition-colors hover:bg-[--surface-sunken] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.4}
    >
      <path d="M8 1.6l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4 4.2 13.4l.7-4.3-3.1-3 4.3-.6L8 1.6z" />
    </svg>
  );
}
