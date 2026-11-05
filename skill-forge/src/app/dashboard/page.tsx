'use client';

import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  markPublished,
  readLocalSkills,
  removeLocalSkill,
  type LocalSkill,
} from '@/lib/localstore';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [creations, setCreations] = useState<LocalSkill[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // L'archivio locale vive nel browser: si legge solo dopo il montaggio.
  useEffect(() => {
    setCreations(readLocalSkills());
  }, []);

  const owner = session?.user?.login ?? 'il tuo account';

  async function publish(skill: LocalSkill) {
    setBusyId(skill.id);
    setNotice(null);
    try {
      const res = await fetch('/api/marketplace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: skill.markdown,
          name: skill.name,
          description: skill.description,
        }),
      });
      const data = (await res.json()) as { error?: string; skill?: { id: string } };
      if (!res.ok || !data.skill) throw new Error(data.error ?? 'Pubblicazione fallita');
      setCreations(markPublished(skill.id, data.skill.id));
      setNotice(`"${skill.name}" pubblicata sul marketplace.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setBusyId(null);
    }
  }

  function download(skill: LocalSkill) {
    const blob = new Blob([skill.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skill.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function remove(skill: LocalSkill) {
    setCreations(removeLocalSkill(skill.id));
    setNotice(`"${skill.name}" rimossa dall'archivio locale.`);
  }

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
            Le skill generate restano nel browser, ma per pubblicarle sul
            marketplace serve l&apos;accesso con GitHub.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main id="contenuto" className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
          Le mie creazioni
        </h1>

        <p className="mt-6 max-w-prose text-[17px] text-[--ink-muted]">
          Ogni skill che generi resta salvata in questo browser, anche se non la
          scarichi e non la committi. Da qui puoi pubblicarla sul{' '}
          <Link href="/marketplace" className="text-[--accent] underline underline-offset-2">
            marketplace
          </Link>
          , dove chiunque può scaricarla e metterle una stella. Le skill
          pubblicate su GitHub restano nei repository del tuo account{' '}
          <strong className="text-[--ink]">@{owner}</strong>.
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
        </div>

        {notice && (
          <p className="mt-6 rounded-xl border border-[--line] bg-[--surface-sunken] px-4 py-3 text-sm text-[--ink]">
            {notice}
          </p>
        )}

        <div className="hairline my-10" />

        {creations.length === 0 ? (
          <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-8 text-center">
            <p className="font-display text-lg font-semibold text-[--ink]">
              Nessuna creazione salvata
            </p>
            <p className="mt-2 text-sm text-[--ink-muted]">
              Le skill che generi compaiono qui automaticamente.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl font-semibold text-[--ink]">
              Salvate in questo browser
            </h2>
            <ul className="mt-4 space-y-3">
              {creations.map((skill) => (
                <li key={skill.id} className="surface-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-semibold text-[--ink]">
                        {skill.name}
                      </h3>
                      {skill.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-[--ink-muted]">
                          {skill.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-[--ink-muted]">
                        {skill.publishedId ? (
                          <span className="text-[--accent]">Sul marketplace</span>
                        ) : (
                          'Solo in locale'
                        )}
                        {' · '}
                        {new Date(skill.updatedAt).toLocaleDateString('it-IT')}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        disabled={busyId === skill.id}
                        onClick={() => void publish(skill)}
                        className="rounded-lg border border-[--accent] bg-[--accent-soft] px-3.5 py-2 text-sm font-medium text-[--accent] transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {busyId === skill.id
                          ? 'Pubblico...'
                          : skill.publishedId
                            ? 'Aggiorna'
                            : 'Pubblica'}
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => download(skill)}
                          className="rounded-lg border border-[--line] px-3 py-1.5 text-xs text-[--ink-muted] transition-colors hover:text-[--ink]"
                        >
                          Scarica
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(skill)}
                          className="rounded-lg border border-[--line] px-3 py-1.5 text-xs text-[--ink-muted] transition-colors hover:text-[oklch(45%_0.14_28)]"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
