'use client';

import { AUDIENCES, TONES, type AudienceId, type ToneId } from '@/lib/audience';

/**
 * The two choices that shape the output before any material is read: who will
 * execute the skill, and how it should read.
 */
export function AudiencePicker({
  value,
  onChange,
}: {
  value: AudienceId;
  onChange: (id: AudienceId) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-medium text-[--ink]">Who is this for?</span>
        <span className="text-xs text-[--ink-muted]">
          Changes the paths, the commands and the level of detail
        </span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {AUDIENCES.map((a) => {
          const active = a.id === value;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              aria-pressed={active}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                active
                  ? 'border-[--accent] bg-[--accent-soft]'
                  : 'border-[--line] bg-[--surface-raised] hover:border-[--accent]'
              }`}
            >
              <span
                className={`block text-sm font-medium ${active ? 'text-[--accent]' : 'text-[--ink]'}`}
              >
                {a.label}
              </span>
              <span className="mt-1 block text-xs text-[--ink-muted]">{a.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TonePicker({
  value,
  onChange,
}: {
  value: ToneId;
  onChange: (id: ToneId) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-medium text-[--ink]">Tone</span>
        <span className="text-xs text-[--ink-muted]">Same content, different register</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {TONES.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-pressed={active}
              title={t.hint}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                active
                  ? 'border-[--accent] bg-[--accent-soft] text-[--accent]'
                  : 'border-[--line] bg-[--surface-raised] text-[--ink-muted] hover:text-[--ink]'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[--ink-muted]">{TONES.find((t) => t.id === value)?.hint}</p>
    </fieldset>
  );
}
