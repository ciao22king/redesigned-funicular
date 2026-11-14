import { SAMPLES } from '@/lib/samples';

/**
 * Side-by-side comparison: the raw material on the left, the skill it produces
 * on the right. It is rendered on the server, with no model call, so the
 * comparison is in the HTML and visible to a crawler.
 */
export function BeforeAfter() {
  const sample = SAMPLES[0];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <figure className="rounded-2xl border border-[--line] bg-[--surface-sunken] p-6">
        <figcaption className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[--ink-muted]">
          <span className="h-1.5 w-1.5 rounded-full bg-[--ink-muted]/50" />
          Before · {sample.label}
        </figcaption>
        <pre className="max-h-[340px] overflow-auto whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-[--ink-muted]">
          {sample.raw}
        </pre>
      </figure>

      <figure className="rounded-2xl border border-[--accent] bg-[--surface-raised] p-6">
        <figcaption className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[--accent]">
          <span className="h-1.5 w-1.5 rounded-full bg-[--accent]" />
          After · one skill
        </figcaption>
        <pre className="max-h-[340px] overflow-auto whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-[--ink]">
          {sample.skill}
        </pre>
      </figure>
    </div>
  );
}
