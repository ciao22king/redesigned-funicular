'use client';

/**
 * Which model generates the skill: the one on the device, or the hosted one.
 *
 * The device model is the default and the reason the page exists: it costs
 * nothing and the material never leaves the browser. The hosted one is offered
 * as an explicit choice, because it is a bigger model and produces a better
 * document on long or subtle material — but it sends the material to a server,
 * which the visitor has to opt into knowingly.
 */

export type ModelChoice = 'device' | 'hosted';

export function ModelPicker({
  value,
  onChange,
  hostedAvailable,
  disabled,
}: {
  value: ModelChoice;
  onChange: (choice: ModelChoice) => void;
  /** False when the server has no provider enabled: the option is then shown as unavailable. */
  hostedAvailable: boolean;
  disabled?: boolean;
}) {
  const options: { id: ModelChoice; title: string; note: string }[] = [
    {
      id: 'device',
      title: 'On your device',
      note: 'Runs in this browser. Free, private, nothing is uploaded. A 1.5B model, downloaded once.',
    },
    {
      id: 'hosted',
      title: 'On our servers',
      note: hostedAvailable
        ? 'A larger model, better on long material. Your material is sent to the server.'
        : 'Currently unavailable.',
    },
  ];

  return (
    <fieldset disabled={disabled} className="rounded-2xl border border-[--line] p-4">
      <legend className="px-1 font-mono text-[11px] uppercase tracking-widest text-[--ink-muted]">
        Model
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const unavailable = o.id === 'hosted' && !hostedAvailable;
          const selected = value === o.id;
          return (
            <label
              key={o.id}
              className={[
                'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors',
                selected ? 'border-[--accent] bg-[--surface-sunken]' : 'border-[--line]',
                unavailable ? 'cursor-not-allowed opacity-50' : '',
              ].join(' ')}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="model-choice"
                  value={o.id}
                  checked={selected}
                  disabled={unavailable}
                  onChange={() => onChange(o.id)}
                  className="accent-[--accent]"
                />
                <span className="text-sm font-medium text-[--ink]">{o.title}</span>
              </span>
              <span className="text-xs text-[--ink-muted]">{o.note}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
