'use client';

import type { QualityReport } from '@/lib/quality';

/**
 * The quality report and the clarifying questions, shown together: both are
 * "here is what is still weak", so they belong in one panel.
 */
export function QualityPanel({ report }: { report: QualityReport }) {
  const errors = report.findings.filter((f) => f.level === 'error');
  const warnings = report.findings.filter((f) => f.level === 'warning');

  return (
    <div className="rounded-xl border border-[--line] bg-[--surface-raised] p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-[--ink]">Automatic quality check</h3>
        <span
          className={`font-mono text-sm ${
            report.ok ? 'text-[--accent]' : 'text-[oklch(50%_0.16_28)]'
          }`}
        >
          {report.score}/100
        </span>
      </div>

      <p className="mt-2 text-xs text-[--ink-muted]">
        {report.stats.words} words · {report.stats.sections} sections ·{' '}
        {report.stats.steps} steps · {report.stats.examples} example(s) ·{' '}
        {report.stats.checklistItems} checklist item(s)
      </p>

      {report.findings.length === 0 ? (
        <p className="mt-3 text-sm text-[--accent]">
          Structure complete, steps actionable, examples present.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {[...errors, ...warnings].map((f) => (
            <li key={f.code} className="flex gap-2 text-sm">
              <span
                aria-hidden
                className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                  f.level === 'error' ? 'bg-[oklch(55%_0.18_28)]' : 'bg-[oklch(70%_0.14_70)]'
                }`}
              />
              <span className={f.level === 'error' ? 'text-[--ink]' : 'text-[--ink-muted]'}>
                {f.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The 3 to 5 clarifying questions. They are answers to give back to the model,
 * so each one has a field: the value is appended to the material on the next
 * regeneration, which is the whole point of asking.
 */
export function QuestionsPanel({
  questions,
  answers,
  onAnswer,
  onApply,
  busy,
}: {
  questions: string[];
  answers: Record<number, string>;
  onAnswer: (index: number, value: string) => void;
  onApply: () => void;
  busy: boolean;
}) {
  if (questions.length === 0) return null;
  const answered = Object.values(answers).filter((v) => v.trim().length > 0).length;

  return (
    <div className="rounded-xl border border-[--accent] bg-[--accent-soft] p-5">
      <h3 className="text-sm font-medium text-[--ink]">
        {questions.length} questions to close the gaps
      </h3>
      <p className="mt-1 text-xs text-[--ink-muted]">
        The draft does not invent what it cannot verify. Answer and the section is
        rewritten with your answers.
      </p>

      <ol className="mt-4 space-y-3">
        {questions.map((q, i) => (
          <li key={q}>
            <label className="block">
              <span className="mb-1.5 block text-sm text-[--ink]">
                {i + 1}. {q}
              </span>
              <input
                value={answers[i] ?? ''}
                onChange={(e) => onAnswer(i, e.target.value)}
                placeholder="Your answer, one line"
                className="w-full rounded-lg border border-[--line] bg-[--surface-raised] px-3 py-2 text-sm text-[--ink] outline-none transition-colors focus:border-[--accent]"
              />
            </label>
          </li>
        ))}
      </ol>

      <button
        type="button"
        disabled={busy || answered === 0}
        onClick={onApply}
        className="mt-4 rounded-xl bg-[--accent] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Rewriting...' : 'Rewrite with these answers'}
      </button>
      {answered === 0 && (
        <p className="mt-2 text-xs text-[--ink-muted]">
          Answer at least one question to enable the rewrite.
        </p>
      )}
    </div>
  );
}
