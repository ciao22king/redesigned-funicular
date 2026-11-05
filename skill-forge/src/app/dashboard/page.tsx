'use client';

import { Nav } from '@/components/Nav';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function Dashboard() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <>
        <Nav />
        <main id="contenuto" className="mx-auto max-w-3xl px-6 py-24">
          <p className="text-[--ink-muted]">Caricamento...</p>
        </main>
      </>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <>
        <Nav />
        <main id="contenuto" className="mx-auto max-w-3xl px-6 py-24">
          <h1 className="font-display text-3xl font-semibold text-[--ink]">
            Accedi per vedere le tue skill
          </h1>
          <p className="mt-4 max-w-prose text-[--ink-muted]">
            Le skill non vengono archiviate su questo sito. Restano nei tuoi
            repository GitHub, che sono la fonte di verità.
          </p>
        </main>
      </>
    );
  }

  const owner = session?.user?.login ?? 'il tuo account';

  return (
    <>
      <Nav />
      <main id="contenuto" className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
          Le mie skill
        </h1>

        <p className="mt-6 max-w-prose text-[17px] text-[--ink-muted]">
          Le skill che generi qui non restano su questo sito. Vengono salvate
          sui repository del tuo account <strong className="text-[--ink]">@{owner}</strong>,
          tipicamente sotto <code className="font-mono text-[14px]">my-skills/skills/</code>.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/create/from-skills"
            className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Nuova skill da materiale
          </Link>
          <Link
            href="/create/from-scratch"
            className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
          >
            Nuova skill da zero
          </Link>
          <a
            href={`https://github.com/${owner}?tab=repositories`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
          >
            Apri GitHub
          </a>
        </div>

        <div className="hairline my-12" />

        <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-7">
          <h2 className="font-display text-xl font-semibold text-[--ink]">
            Vuoi un elenco automatico?
          </h2>
          <p className="mt-3 max-w-prose text-[15px] text-[--ink-muted]">
            Per mostrare qui la lista reale delle skill servirebbe un endpoint
            aggiuntivo che legge l&apos;albero del repository. Il punto di
            estensione è già pronto in{' '}
            <code className="font-mono text-[13px]">src/lib/github.ts</code>,
            dove sono definite le funzioni di commit: basta aggiungerne una di
            lettura e una rotta che la espone.
          </p>
        </div>
      </main>
    </>
  );
}
