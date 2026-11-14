'use client';

import type { Plan } from '@/lib/plan';
import { audienceLabel } from '@/lib/plan';

/**
 * The pre-generation summary. It shows what the system understood, so the user
 * can correct it before spending a generation, and it lists what is missing
 * instead of letting the model quietly fill it in.
 */
export function PlanSummary({ plan, onConfirm, busy }: { plan: Plan; onConfirm: () => void; busy: boolean }) {
  return (
    <div className="rounded-xl border border-[--line] bg-[--surface-raised] p-5">
      <h3 className="text-sm font-medium text-[--ink]">Before generating, here is what I understood</h3>

      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Row label="Title" value={plan.title} />
        <Row label="Audience" value={audienceLabel(plan.audience)} />
        <Row label="Objective" value={plan.objective} wide />
        <Row
          label="Constraints detected"
          value={plan.constraints.length > 0 ? plan.constraints.join(' · ') : 'None stated in the material'}
          wide
        />
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.12em] text-[--ink-muted]">Materials</dt>
          <dd className="mt-1.5 flex flex-wrap gap-2">
            {plan.materials.map((m, i) => (
              <span
                key={`${m.label}-${i}`}
                className="rounded-full border border-[--line] bg-[--surface-sunken] px-3 py-1 font-mono text-xs text-[--ink-muted]"
              >
                {m.kind} · {m.label} · {m.chars.toLocaleString('en-US')} chars
              </span>
            ))}
          </dd>
        </div>
      </dl>

      {plan.missing.length > 0 && (
        <div className="mt-5 rounded-lg border border-[oklch(75%_0.13_70)] bg-[oklch(96%_0.03_80)] p-4">
          <p className="text-sm font-medium text-[oklch(35%_0.09_70)]">
            {plan.missing.length} piece(s) of information are missing
          </p>
          <ul className="mt-2 space-y-1">
            {plan.missing.map((m, i) => (
              <li key={i} className="text-sm text-[oklch(38%_0.08_70)]">
                {m}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[oklch(42%_0.07_70)]">
            The model will flag these in the skill and ask about them. It will not
            invent answers.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className="mt-5 rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Generating...' : 'Looks right, generate'}
      </button>
    </div>
  );
}

function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs uppercase tracking-[0.12em] text-[--ink-muted]">{label}</dt>
      <dd className="mt-1 text-sm text-[--ink]">{value}</dd>
    </div>
  );
}
