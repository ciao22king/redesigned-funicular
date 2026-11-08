'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/Nav';
import {
  countWords,
  readFrontmatterDescription,
  readFrontmatterName,
  slugify,
} from '@/lib/skill';
import { markPublished, saveLocalSkill } from '@/lib/localstore';

type Mode = 'from-skills' | 'from-scratch';

interface Quota {
  used: number;
  remaining: number;
  limit: number;
  resetsAt: string;
  unlimited?: boolean;
}

interface GenerateResponse {
  markdown?: string;
  error?: string;
  quota?: Quota;
}

export default function CreatePage({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    fetch('/api/generate')
      .then((r) => (r.ok ? (r.json() as Promise<Quota>) : null))
      .then((d) => d && setQuota(d))
      .catch(() => {});
  }, []);

  // "from existing skills" mode fields
  const [files, setFiles] = useState<{ name: string; text: string }[]>([]);
  const [pasted, setPasted] = useState('');

  // "from scratch" mode fields
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [goal, setGoal] = useState('');
  const [tone, setTone] = useState('');
  const [constraints, setConstraints] = useState('');
  const [examples, setExamples] = useState('');

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const next: { name: string; text: string }[] = [];
    for (const f of Array.from(list).slice(0, 20)) {
      next.push({ name: f.name, text: await f.text() });
    }
    setFiles((prev) => [...prev, ...next]);
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setResult(null);

    const sourceMaterial =
      mode === 'from-skills'
        ? [
            ...files.map((f) => `## File: ${f.name}\n\n${f.text}`),
            pasted.trim() ? `## Testo incollato\n\n${pasted}` : '',
          ]
            .filter(Boolean)
            .join('\n\n')
        : undefined;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'from-skills'
            ? { mode, sourceMaterial }
            : { mode, name, domain, goal, tone, constraints, examples },
        ),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.quota) setQuota(data.quota);
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      const markdown = data.markdown as string;
      setResult(markdown);

      // Every generated skill enters the local archive right away: it stays
      // findable even if it is not downloaded or committed.
      const skillName = readFrontmatterName(markdown) ?? name.trim() ?? 'Untitled skill';
      saveLocalSkill({
        markdown,
        name: skillName,
        description: readFrontmatterDescription(markdown) ?? '',
        source: mode,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(name || 'skill')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ready =
    mode === 'from-skills'
      ? files.length > 0 || pasted.trim().length > 60
      : name.trim() && domain.trim() && goal.trim();

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mb-8 text-sm text-[--ink-muted] transition-colors hover:text-[--ink]"
        >
          ← Back to the choice
        </button>

        <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-[--accent]">
          {mode === 'from-skills' ? 'Mode A · From existing material' : 'Mode B · From scratch'}
        </p>

        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[--ink]">
          {mode === 'from-skills'
            ? 'From scattered notes to a complete skill'
            : 'Build a skill from scratch'}
        </h1>

        <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
          {mode === 'from-skills'
            ? 'Upload documents, notes or draft skills. The model merges them into one detailed document: it identifies missing information and asks targeted questions instead of inventing content, and keeps every technical detail.'
            : 'Answer six questions. The model writes the full procedure, with examples, common mistakes and a verification checklist.'}
        </p>

        <div className="hairline my-10" />

        <div className="mb-8 rounded-xl border border-[--line] bg-[--surface-sunken] px-4 py-3 text-sm text-[--ink-muted]">
          Do not upload proprietary code, customer data, passwords or confidential
          documents.
        </div>

        {mode === 'from-skills' ? (
          <div className="space-y-7">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[--ink]">
                Source files
              </span>
              <span className="mb-3 block text-sm text-[--ink-muted]">
                Markdown, text, JSON, code. Up to 20 files.
              </span>
              <input
                type="file"
                multiple
                accept=".md,.txt,.json,.yaml,.yml,.ts,.tsx,.js,.py,.html,.css"
                onChange={(e) => onFiles(e.target.files)}
                className="block w-full cursor-pointer rounded-xl border border-dashed border-[--line] bg-[--surface-raised] px-4 py-6 text-sm text-[--ink-muted] transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-[--accent-soft] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[--accent]"
              />
            </label>

            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between rounded-lg bg-[--surface-sunken] px-3 py-2 text-sm"
                  >
                    <span className="truncate text-[--ink]">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                      className="ml-3 shrink-0 text-xs text-[--ink-muted] transition-colors hover:text-[--accent]"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[--ink]">
                Or paste the text
              </span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={9}
                placeholder="Paste notes, a transcript, a draft skill here..."
                className="w-full resize-y rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink] outline-none transition-colors placeholder:text-[--ink-muted]/60 focus:border-[--accent]"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <Field label="Skill name" hint="What the document will be called">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pull request review"
                className={inputClass}
              />
            </Field>
            <Field label="Domain" hint="The field it operates in">
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. software development, data analysis, technical writing"
                className={inputClass}
              />
            </Field>
            <Field label="Goal" hint="What it must achieve, measurably">
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                placeholder="e.g. analyze a PR and produce a report with blocking issues, suggestions and regression risks"
                className={`${inputClass} resize-y`}
              />
            </Field>
            <Field label="Tone" hint="Optional">
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g. direct, technical, no fluff"
                className={inputClass}
              />
            </Field>
            <Field label="Constraints" hint="Optional, but useful">
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                rows={3}
                placeholder="e.g. do not comment on style, only correctness and security"
                className={`${inputClass} resize-y`}
              />
            </Field>
            <Field label="Examples or use cases" hint="Optional">
              <textarea
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                rows={3}
                placeholder="e.g. a 400-line PR touching authentication and caching"
                className={`${inputClass} resize-y`}
              />
            </Field>
          </div>
        )}

        <div className="mt-10">
          <button
            type="button"
            disabled={!ready || busy || (!!quota && !quota.unlimited && quota.remaining === 0)}
            onClick={generate}
            className="w-full rounded-xl bg-[--accent] px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Generating...' : 'Generate the skill'}
          </button>

          {quota && (
            <p
              className={`mt-3 text-center text-sm ${
                !quota.unlimited && quota.remaining === 0
                  ? 'text-[oklch(45%_0.14_28)]'
                  : 'text-[--ink-muted]'
              }`}
            >
              {quota.unlimited
                ? 'Unlimited generations.'
                : quota.remaining > 0
                  ? `${quota.remaining} of ${quota.limit} generations left today.`
                  : `You have used all ${quota.limit} generations today. The quota resets on ${new Date(
                      quota.resetsAt,
                    ).toLocaleString('en-US', { timeZone: 'UTC' })} UTC.`}
            </p>
          )}

          {!ready && (
            <p className="mt-3 text-center text-sm text-[--ink-muted]">
              {mode === 'from-skills'
                ? 'Add at least one file or paste some text.'
                : 'Fill in name, domain and goal.'}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-[oklch(70%_0.14_28)] bg-[oklch(95%_0.04_30)] px-4 py-3 text-sm text-[oklch(38%_0.13_28)]">
            {error}
          </div>
        )}

        {result && (
          <ResultPanel
            markdown={result}
            name={name}
            onEdit={setResult}
            onDownload={download}
          />
        )}
      </main>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-medium text-[--ink]">{label}</span>
        {hint && <span className="text-xs text-[--ink-muted]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink] outline-none transition-colors placeholder:text-[--ink-muted]/60 focus:border-[--accent]';

function ResultPanel({
  markdown,
  name,
  onEdit,
  onDownload,
}: {
  markdown: string;
  name: string;
  onEdit: (next: string) => void;
  onDownload: () => void;
}) {
  const [marketBusy, setMarketBusy] = useState(false);
  const [market, setMarket] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMarket('Copy failed. Select the text and copy it manually.');
    }
  }

  async function publishToMarketplace() {
    setMarketBusy(true);
    setMarket(null);
    try {
      const res = await fetch('/api/marketplace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      });
      const data = (await res.json()) as {
        error?: string;
        skill?: { id: string; name: string };
      };
      if (!res.ok || !data.skill) throw new Error(data.error ?? 'Publishing failed');

      // The local copy also remembers it was published.
      const localName = readFrontmatterName(markdown) ?? name.trim() ?? 'Untitled skill';
      markPublished(slugify(localName), data.skill.id);
      setMarket(`Published to the marketplace as "${data.skill.name}".`);
    } catch (e) {
      setMarket(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setMarketBusy(false);
    }
  }

  return (
    <section className="mt-14 animate-fade-up">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold text-[--ink]">
          Generated skill
        </h2>
        <span className="font-mono text-xs text-[--ink-muted]">
          {countWords(markdown)} words
        </span>
      </div>

      {editing ? (
        <textarea
          value={markdown}
          onChange={(e) => onEdit(e.target.value)}
          rows={26}
          spellCheck={false}
          className="w-full resize-y rounded-xl border border-[--accent] bg-[oklch(20%_0.02_50)] p-5 font-mono text-[12.5px] leading-relaxed text-[oklch(91%_0.03_70)] outline-none"
        />
      ) : (
        <pre className="max-h-[520px] overflow-auto rounded-xl border border-[--line] bg-[oklch(20%_0.02_50)] p-5 font-mono text-[12.5px] leading-relaxed text-[oklch(91%_0.03_70)]">
          {markdown}
        </pre>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
        >
          {editing ? 'Done editing' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={() => void copyMarkdown()}
          className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
        >
          {copied ? 'Copied' : 'Copy Markdown'}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Download the .md file
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={marketBusy}
          onClick={() => void publishToMarketplace()}
          className="rounded-xl border border-[--accent] bg-[--accent-soft] px-5 py-3 text-sm font-medium text-[--accent] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {marketBusy ? 'Publishing...' : 'Publish to the marketplace'}
        </button>
        <span className="text-xs text-[--ink-muted]">
          Other people will be able to download it and star it.
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-[--line] bg-[--surface-sunken] px-4 py-3 text-sm text-[--ink-muted]">
        Do not upload proprietary code, customer data, passwords or confidential
        documents. The material you submit is sent to the AI provider to generate
        the skill.
      </div>

      {market && <p className="mt-4 text-sm text-[--ink]">{market}</p>}
    </section>
  );
}
