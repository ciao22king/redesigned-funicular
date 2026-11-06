'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/Nav';
import {
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

  // campi modalità "da skill esistenti"
  const [files, setFiles] = useState<{ name: string; text: string }[]>([]);
  const [pasted, setPasted] = useState('');

  // campi modalità "da zero"
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
      if (!res.ok) throw new Error(data.error ?? 'Errore nella generazione');
      const markdown = data.markdown as string;
      setResult(markdown);

      // Ogni skill generata entra subito nell'archivio locale: resta
      // ritrovabile anche se non viene scaricata ne' committata.
      const skillName = readFrontmatterName(markdown) ?? name.trim() ?? 'Skill senza nome';
      saveLocalSkill({
        markdown,
        name: skillName,
        description: readFrontmatterDescription(markdown) ?? '',
        source: mode,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
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
      <main id="contenuto" className="mx-auto max-w-3xl px-6 py-14">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mb-8 text-sm text-[--ink-muted] transition-colors hover:text-[--ink]"
        >
          ← Torna alla scelta
        </button>

        <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-[--accent]">
          Modalità {mode === 'from-skills' ? 'A · Da materiale esistente' : 'B · Da zero'}
        </p>

        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[--ink]">
          {mode === 'from-skills'
            ? 'Da appunti sparsi a skill completa'
            : 'Costruisci una skill da zero'}
        </h1>

        <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
          {mode === 'from-skills'
            ? 'Carica documenti, appunti o skill abbozzate. Il modello le fonde in un unico documento dettagliato, colmando i buchi e conservando ogni dettaglio tecnico.'
            : 'Rispondi a sei domande. Il modello scrive la procedura completa, con esempi, errori comuni e checklist di verifica.'}
        </p>

        <div className="hairline my-10" />

        {mode === 'from-skills' ? (
          <div className="space-y-7">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[--ink]">
                File sorgente
              </span>
              <span className="mb-3 block text-sm text-[--ink-muted]">
                Markdown, testo, JSON, codice. Fino a 20 file.
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
                      rimuovi
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[--ink]">
                Oppure incolla il testo
              </span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={9}
                placeholder="Incolla qui note, una trascrizione, una skill abbozzata..."
                className="w-full resize-y rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm text-[--ink] outline-none transition-colors placeholder:text-[--ink-muted]/60 focus:border-[--accent]"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <Field label="Nome della skill" hint="Come si chiamerà il documento">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Revisione di pull request"
                className={inputClass}
              />
            </Field>
            <Field label="Dominio" hint="Ambito in cui opera">
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="es. sviluppo software, analisi dati, scrittura tecnica"
                className={inputClass}
              />
            </Field>
            <Field label="Obiettivo" hint="Cosa deve far raggiungere, in modo misurabile">
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                placeholder="es. analizzare una PR e produrre un report con problemi bloccanti, suggerimenti e rischi di regressione"
                className={`${inputClass} resize-y`}
              />
            </Field>
            <Field label="Tono" hint="Opzionale">
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="es. diretto, tecnico, senza giri di parole"
                className={inputClass}
              />
            </Field>
            <Field label="Vincoli" hint="Opzionale, ma utile">
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                rows={3}
                placeholder="es. non commentare lo stile, solo correttezza e sicurezza"
                className={`${inputClass} resize-y`}
              />
            </Field>
            <Field label="Esempi o casi d'uso" hint="Opzionale">
              <textarea
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                rows={3}
                placeholder="es. una PR da 400 righe che tocca autenticazione e cache"
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
            {busy ? 'Generazione in corso...' : 'Genera la skill'}
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
                ? 'Generazioni illimitate.'
                : quota.remaining > 0
                  ? `Ti restano ${quota.remaining} generazioni su ${quota.limit} per oggi.`
                  : `Hai usato tutte le ${quota.limit} generazioni di oggi. La quota si azzera il ${new Date(
                      quota.resetsAt,
                    ).toLocaleString('it-IT', { timeZone: 'UTC' })} UTC.`}
            </p>
          )}

          {!ready && (
            <p className="mt-3 text-center text-sm text-[--ink-muted]">
              {mode === 'from-skills'
                ? 'Aggiungi almeno un file o incolla del testo.'
                : 'Compila nome, dominio e obiettivo.'}
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
  onDownload,
}: {
  markdown: string;
  name: string;
  onDownload: () => void;
}) {
  const [marketBusy, setMarketBusy] = useState(false);
  const [market, setMarket] = useState<string | null>(null);

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
      if (!res.ok || !data.skill) throw new Error(data.error ?? 'Pubblicazione fallita');

      // Anche la copia locale ricorda di essere pubblicata.
      const localName = readFrontmatterName(markdown) ?? name.trim() ?? 'Skill senza nome';
      markPublished(slugify(localName), data.skill.id);
      setMarket(`Pubblicata sul marketplace come "${data.skill.name}".`);
    } catch (e) {
      setMarket(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setMarketBusy(false);
    }
  }

  return (
    <section className="mt-14 animate-fade-up">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold text-[--ink]">
          Skill generata
        </h2>
        <span className="font-mono text-xs text-[--ink-muted]">
          {markdown.split(/\s+/).filter(Boolean).length} parole
        </span>
      </div>

      <pre className="max-h-[520px] overflow-auto rounded-xl border border-[--line] bg-[oklch(20%_0.02_50)] p-5 font-mono text-[12.5px] leading-relaxed text-[oklch(91%_0.03_70)]">
        {markdown}
      </pre>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDownload}
          className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Scarica il file .md
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={marketBusy}
          onClick={() => void publishToMarketplace()}
          className="rounded-xl border border-[--accent] bg-[--accent-soft] px-5 py-3 text-sm font-medium text-[--accent] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {marketBusy ? 'Pubblico...' : 'Pubblica sul marketplace'}
        </button>
        <span className="text-xs text-[--ink-muted]">
          Le altre persone potranno scaricarla e metterle una stella.
        </span>
      </div>

      {market && (
        <p className="mt-4 text-sm text-[--ink]">{market}</p>
      )}
    </section>
  );
}
