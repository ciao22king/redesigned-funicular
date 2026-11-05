'use client';

import { Nav } from '@/components/Nav';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';

export default function Home() {
  const { status } = useSession();

  return (
    <>
      <Nav />

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero: asimmetrico, non tutto centrato */}
        <section className="grid items-start gap-14 py-20 lg:grid-cols-[1.35fr_1fr] lg:py-28">
          <div className="animate-fade-up">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[--line] bg-[--surface-raised] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[--ink-muted]">
              <span className="h-1.5 w-1.5 rounded-full bg-[--accent]" />
              Per agenti AI
            </p>

            <h1 className="font-display text-[clamp(2.6rem,6vw,4.4rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-[--ink]">
              Le tue note non sono
              <br />
              una skill.
              <br />
              <span className="text-[--accent]">Noi le rendiamo tali.</span>
            </h1>

            <p className="mt-8 max-w-prose text-[18px] leading-relaxed text-[--ink-muted]">
              Carica appunti, documenti o bozze, oppure parti da zero.
              Il modello scrive un documento operativo con procedura numerata,
              esempi, errori comuni e checklist di verifica.
              Poi lo scarichi o lo pubblichi sul tuo GitHub.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              {status === 'authenticated' ? (
                <Link
                  href="/create/from-skills"
                  className="rounded-xl bg-[--accent] px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90"
                >
                  Crea la tua prima skill
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => signIn('github')}
                  className="rounded-xl bg-[--accent] px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90"
                >
                  Accedi con GitHub
                </button>
              )}
              <Link
                href="/create/from-scratch"
                className="rounded-xl border border-[--line] bg-[--surface-raised] px-6 py-3.5 font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
              >
                Parti da zero
              </Link>
            </div>
          </div>

          {/* Pannello laterale: esempio di output, non una card decorativa */}
          <aside className="animate-fade-up rounded-2xl border border-[--line] bg-[--surface-raised] p-6 lg:mt-6">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[--ink-muted]">
              Output tipico
            </p>
            <div className="space-y-3 font-mono text-[12.5px] leading-relaxed text-[--ink-muted]">
              <p className="text-[--ink]">---</p>
              <p className="text-[--ink]">name: revisione-pull-request</p>
              <p className="text-[--ink]">description: Analizza una PR e produce un report con blocchi, suggerimenti e rischi.</p>
              <p className="text-[--ink]">---</p>
              <div className="hairline my-4" />
              <p className="text-[--ink]">## Procedura</p>
              <p>1. Leggi il diff completo prima di commentare.</p>
              <p>2. Separa problemi bloccanti da suggerimenti.</p>
              <p>3. Verifica ogni affermazione sul codice, non sulla descrizione.</p>
            </div>
          </aside>
        </section>

        <div className="hairline" />

        {/* Le due modalità: differenziate, non due card identiche */}
        <section className="py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
            Due modi di partire
          </h2>

          <div className="mt-12 space-y-4">
            <ModeRow
              letter="A"
              title="Ho già del materiale"
              body="Trascrizioni, appunti, PDF esportati, una skill abbozzata. Il modello fonde tutto in un unico documento, colma i buchi e conserva ogni dettaglio tecnico."
              href="/create/from-skills"
              cta="Carica materiale"
            />
            <ModeRow
              letter="B"
              title="Parto da un'idea"
              body="Sei domande su nome, dominio, obiettivo, tono e vincoli. Il modello scrive la procedura completa da zero, con esempi realistici e errori comuni."
              href="/create/from-scratch"
              cta="Compila il wizard"
            />
          </div>
        </section>

        <div className="hairline" />

        {/* Come funziona: sequenza numerata, non griglia */}
        <section className="py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
            Come funziona
          </h2>
          <ol className="mt-12 grid gap-x-14 gap-y-10 md:grid-cols-2">
            <Step n="1" t="Accedi con GitHub">
              Un click, scope <code className="font-mono text-[13px]">repo</code> incluso.
              Serve per pubblicare le skill nel tuo repository.
            </Step>
            <Step n="2" t="Dai il materiale o rispondi al wizard">
              Fino a venti file, oppure sei campi. Il materiale resta solo
              nella richiesta, non viene archiviato.
            </Step>
            <Step n="3" t="Il modello scrive la skill">
              Struttura fissa: quando usarla, prerequisiti, procedura,
              esempi, errori comuni, checklist.
            </Step>
            <Step n="4" t="Scarica o pubblica">
              File <code className="font-mono text-[13px]">.md</code> pronto,
              oppure commit diretto sul repository che indichi.
            </Step>
          </ol>
        </section>
      </main>

      <footer className="mt-10 border-t border-[--line] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-[--ink-muted]">
          <p>Skill Forge · costruito con Next.js</p>
          <p className="font-mono text-xs">
            Modello: modelli free di OpenRouter, con fallback automatico
          </p>
        </div>
      </footer>
    </>
  );
}

function ModeRow({
  letter,
  title,
  body,
  href,
  cta,
}: {
  letter: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group grid items-center gap-6 rounded-2xl border border-[--line] bg-[--surface-raised] p-7 transition-all duration-200 hover:border-[--accent] md:grid-cols-[auto_1fr_auto]"
    >
      <span className="font-display text-4xl font-semibold text-[--accent-soft] transition-colors group-hover:text-[--accent]">
        {letter}
      </span>
      <div>
        <h3 className="font-display text-xl font-semibold text-[--ink]">
          {title}
        </h3>
        <p className="mt-2 max-w-prose text-[15px] text-[--ink-muted]">{body}</p>
      </div>
      <span className="whitespace-nowrap text-sm font-medium text-[--accent]">
        {cta} →
      </span>
    </Link>
  );
}

function Step({
  n,
  t,
  children,
}: {
  n: string;
  t: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-5">
      <span className="mt-0.5 font-mono text-sm text-[--accent]">{n}.</span>
      <div>
        <h3 className="font-display text-lg font-semibold text-[--ink]">{t}</h3>
        <p className="mt-1.5 max-w-prose text-[15px] text-[--ink-muted]">
          {children}
        </p>
      </div>
    </li>
  );
}
