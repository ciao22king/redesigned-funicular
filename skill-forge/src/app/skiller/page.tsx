import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { SkillerChat } from '@/components/SkillerChat';
import { SKILLER_MODEL_ID } from '@/lib/skiller';

export const metadata: Metadata = {
  title: 'Skiller · a skill assistant that runs on your device',
  description:
    'Skiller is a small model that runs in your browser, on your own device: no account, no server, nothing sent away. It helps you shape and improve skills for AI agents.',
  alternates: { canonical: '/skiller' },
};

export default function SkillerPage() {
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <header>
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-[--ink-muted]">
            Skiller
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[--ink]">
            An assistant that runs on your device
          </h1>
          <p className="mt-3 max-w-prose text-[15px] text-[--ink-muted]">
            {SKILLER_MODEL_ID} runs entirely in your browser, on your own GPU. Your words never
            leave the page, and there is no account and no per-message cost.
          </p>
        </header>

        <div className="hairline my-10" />

        <SkillerChat />

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[--ink]">
            What it does, and what it does not
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-[--ink]">
            <li>It helps you shape a skill: the name, the description, the numbered procedure.</li>
            <li>It tells you which material is missing to make a skill actually executable.</li>
            <li>
              It stays on that job. Ask it about something else and it will say so, rather than
              pretend to be a general assistant.
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[--ink]">
            Honest limits
          </h2>
          <p className="mt-3 max-w-prose text-sm text-[--ink-muted]">
            It is a 0.5-billion-parameter model. It is fast and private, but it is not a frontier
            model: for a long or subtle document, the full generator on the server is better. The
            first load downloads the weights, so give it a moment and a decent connection.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/demo" className="text-[--accent] underline underline-offset-2">
              Use the full generator instead
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
