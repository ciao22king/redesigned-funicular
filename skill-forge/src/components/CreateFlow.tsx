'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { AudiencePicker, TonePicker } from '@/components/GenerateOptions';
import { PlanSummary } from '@/components/PlanSummary';
import { QualityPanel, QuestionsPanel } from '@/components/QualityPanel';
import { SourceInput, type FetchedSource } from '@/components/SourceInput';
import {
  countWords,
  readFrontmatterDescription,
  readFrontmatterName,
  slugify,
} from '@/lib/skill';
import { markPublished, saveLocalSkill } from '@/lib/localstore';
import { DEFAULT_AUDIENCE, DEFAULT_TONE, type AudienceId, type ToneId } from '@/lib/audience';
import { buildPlan, type Plan, type PlanMaterial } from '@/lib/plan';
import { regenerableSections } from '@/lib/sections';
import type { QualityReport } from '@/lib/quality';

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
  questions?: string[];
  quality?: QualityReport;
}

export default function CreatePage({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);

  // Shape of the output: chosen before any material is read.
  const [audience, setAudience] = useState<AudienceId>(DEFAULT_AUDIENCE);
  const [register, setRegister] = useState<ToneId>(DEFAULT_TONE);

  // The pre-generation summary and the questions that follow the draft.
  const [plan, setPlan] = useState<Plan | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [quality, setQuality] = useState<QualityReport | null>(null);

  useEffect(() => {
    fetch('/api/generate')
      .then((r) => (r.ok ? (r.json() as Promise<Quota>) : null))
      .then((d) => d && setQuota(d))
      .catch(() => {});
  }, []);

  // "from existing skills" mode fields
  const [files, setFiles] = useState<{ name: string; text: string }[]>([]);
  const [pasted, setPasted] = useState('');
  const [sources, setSources] = useState<FetchedSource[]>([]);

  // "from scratch" mode fields
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [goal, setGoal] = useState('');
  const [tone, setTone] = useState('');
  const [constraints, setConstraints] = useState('');
  const [examples, setExamples] = useState('');

  /** The material, assembled the same way for the plan and for the request. */
  const material = useMemo(() => {
    if (mode !== 'from-skills') return '';
    return [
      ...files.map((f) => `## File: ${f.name}\n\n${f.text}`),
      ...sources.map((s) => `## Source: ${s.finalUrl ?? s.url}\n\n${s.text}`),
      pasted.trim() ? `## Pasted text\n\n${pasted}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [mode, files, sources, pasted]);

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const next: { name: string; text: string }[] = [];
    for (const f of Array.from(list).slice(0, 20)) {
      next.push({ name: f.name, text: await f.text() });
    }
    setFiles((prev) => [...prev, ...next]);
    setPlan(null);
  }

  /** Builds the summary locally: no model call, so it is instant and free. */
  function preparePlan() {
    setError(null);
    const materials: PlanMaterial[] = [
      ...files.map((f) => ({ kind: 'file' as const, label: f.name, chars: f.text.length })),
      ...sources.map((s) => ({
        kind: 'url' as const,
        label: s.finalUrl ?? s.url,
        chars: s.text.length,
      })),
      ...(pasted.trim()
        ? [{ kind: 'text' as const, label: 'pasted text', chars: pasted.length }]
        : []),
    ];
    const text =
      mode === 'from-skills'
        ? material
        : [name, domain, goal, tone, constraints, examples].filter(Boolean).join('\n');
    setPlan(buildPlan({ text, materials, audience }));
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setResult(null);
    setQuestions([]);
    setAnswers({});
    setQuality(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'from-skills'
            ? { mode, sourceMaterial: material, audience, register }
            : { mode, name, domain, goal, tone, constraints, examples, audience, register },
        ),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.quota) setQuota(data.quota);
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');

      const markdown = data.markdown as string;
      setResult(markdown);
      setQuestions(data.questions ?? []);
      setQuality(data.quality ?? null);
      setPlan(null);

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

  /**
   * Answers become material, then the skill is generated again. This is what
   * makes the questions useful instead of decorative.
   */
  async function applyAnswers() {
    const block = questions
      .map((q, i) => (answers[i]?.trim() ? `- Q: ${q}\n  A: ${answers[i].trim()}` : ''))
      .filter(Boolean)
      .join('\n');
    if (!block) return;

    setBusy(true);
    setError(null);
    try {
      const enriched = `${material}\n\n## Answers to the clarifying questions\n\n${block}`;
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, sourceMaterial: enriched, audience, register }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.quota) setQuota(data.quota);
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setResult(data.markdown as string);
      setQuestions(data.questions ?? []);
      setQuality(data.quality ?? null);
      setAnswers({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  /** Rewrites one section, leaving the rest of the document untouched. */
  async function regenerateSection(section: string, instruction: string) {
    if (!result) return;
    setError(null);
    try {
      const res = await fetch('/api/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: result, section, instruction, audience, register }),
      });
      const data = (await res.json()) as { markdown?: string; error?: string; quota?: Quota };
      if (data.quota) setQuota(data.quota);
      if (!res.ok || !data.markdown) throw new Error(data.error ?? 'The section could not be rewritten.');
      setResult(data.markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(readFrontmatterName(result) ?? name ?? 'skill')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ready =
    mode === 'from-skills'
      ? files.length > 0 || sources.length > 0 || pasted.trim().length > 60
      : Boolean(name.trim() && domain.trim() && goal.trim());

  const outOfQuota = !!quota && !quota.unlimited && quota.remaining === 0;

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
            ? 'Upload documents, paste text or point at a public source. The model merges everything into one document: it flags what is missing and asks about it instead of inventing content.'
            : 'Answer six questions. The model writes the full procedure, with examples, common mistakes and a verification checklist.'}
        </p>

        <div className="hairline my-10" />

        <div className="mb-8 rounded-xl border border-[--line] bg-[--surface-sunken] px-4 py-3 text-sm text-[--ink-muted]">
          Do not upload proprietary code, customer data, passwords or confidential
          documents.
        </div>

        <div className="space-y-7">
          <AudiencePicker value={audience} onChange={setAudience} />
          <TonePicker value={register} onChange={setRegister} />
        </div>

        <div className="hairline my-10" />

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
                      onClick={() => {
                        setFiles((p) => p.filter((_, j) => j !== i));
                        setPlan(null);
                      }}
                      className="ml-3 shrink-0 text-xs text-[--ink-muted] transition-colors hover:text-[--accent]"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <SourceInput
              disabled={outOfQuota}
              onAdd={(s) => {
                setSources((p) => [...p, s]);
                setPlan(null);
              }}
            />

            {sources.length > 0 && (
              <ul className="space-y-1.5">
                {sources.map((s, i) => (
                  <li
                    key={`${s.url}-${i}`}
                    className="flex items-center justify-between rounded-lg bg-[--surface-sunken] px-3 py-2 text-sm"
                  >
                    <span className="truncate text-[--ink]">
                      <span className="mr-2 font-mono text-xs text-[--accent]">{s.kind}</span>
                      {s.finalUrl ?? s.url}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSources((p) => p.filter((_, j) => j !== i));
                        setPlan(null);
                      }}
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
                onChange={(e) => {
                  setPasted(e.target.value);
                  setPlan(null);
                }}
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
            <Field label="Tone notes" hint="Optional, free text">
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g. direct, no fluff"
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
          {plan ? (
            <PlanSummary plan={plan} busy={busy} onConfirm={() => void generate()} />
          ) : (
            <>
              <button
                type="button"
                disabled={!ready || busy || outOfQuota}
                onClick={preparePlan}
                className="w-full rounded-xl bg-[--accent] px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Generating...' : 'Review and generate'}
              </button>

              {quota && (
                <p
                  className={`mt-3 text-center text-sm ${
                    outOfQuota ? 'text-[oklch(45%_0.14_28)]' : 'text-[--ink-muted]'
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
                    ? 'Add at least one file, one source or some pasted text.'
                    : 'Fill in name, domain and goal.'}
                </p>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-[oklch(70%_0.14_28)] bg-[oklch(95%_0.04_30)] px-4 py-3 text-sm text-[oklch(38%_0.13_28)]">
            {error}
          </div>
        )}

        {result && (
          <>
            <section className="mt-12 space-y-4">
              <QuestionsPanel
                questions={questions}
                answers={answers}
                busy={busy}
                onAnswer={(i, v) => setAnswers((p) => ({ ...p, [i]: v }))}
                onApply={() => void applyAnswers()}
              />
              {quality && <QualityPanel report={quality} />}
            </section>

            <ResultPanel
              markdown={result}
              name={name}
              onEdit={setResult}
              onDownload={download}
              onRegenerateSection={regenerateSection}
            />
          </>
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
  onRegenerateSection,
}: {
  markdown: string;
  name: string;
  onEdit: (next: string) => void;
  onDownload: () => void;
  onRegenerateSection: (section: string, instruction: string) => Promise<void>;
}) {
  const [marketBusy, setMarketBusy] = useState(false);
  const [market, setMarket] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [section, setSection] = useState('');
  const [instruction, setInstruction] = useState('');
  const [sectionBusy, setSectionBusy] = useState(false);

  const sections = useMemo(() => regenerableSections(markdown), [markdown]);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMarket('Copy failed. Select the text and copy it manually.');
    }
  }

  async function rewriteSection() {
    if (!section) return;
    setSectionBusy(true);
    try {
      await onRegenerateSection(section, instruction);
      setInstruction('');
    } finally {
      setSectionBusy(false);
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

      {/* Rewrite one section only: the rest of the document is preserved. */}
      <div className="mt-8 rounded-xl border border-[--line] bg-[--surface-raised] p-5">
        <h3 className="text-sm font-medium text-[--ink]">Rewrite one section</h3>
        <p className="mt-1 text-xs text-[--ink-muted]">
          Regenerates the chosen section and leaves everything else untouched.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="rounded-xl border border-[--line] bg-[--surface-raised] px-3 py-2.5 text-sm text-[--ink] outline-none focus:border-[--accent]"
          >
            <option value="">Choose a section</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional: how to change it"
            className="flex-1 rounded-xl border border-[--line] bg-[--surface-raised] px-3 py-2.5 text-sm text-[--ink] outline-none transition-colors placeholder:text-[--ink-muted]/60 focus:border-[--accent]"
          />
          <button
            type="button"
            disabled={!section || sectionBusy}
            onClick={() => void rewriteSection()}
            className="rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sectionBusy ? 'Rewriting...' : 'Rewrite'}
          </button>
        </div>
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
