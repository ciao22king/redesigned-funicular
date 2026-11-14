'use client';

import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { preProgram } from '@/lib/preProgram';

const perks = [
  {
    title: 'Founding tester badge',
    body: 'A badge next to your name on every skill you publish, so it is visible that you were here first.',
  },
  {
    title: `${preProgram.dailyGenerations} generations a day`,
    body: 'A raised daily limit, instead of the standard 3. It stays on your account after the deadline.',
  },
  {
    title: 'OG account rank',
    body: 'Your account is marked as an original, early account, which is what the badge is drawn from.',
  },
];

export default function PreProgramPage() {
  const { data: session, status } = useSession();

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[--ink-muted]">
          Early access
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
          The founding tester program
        </h1>
        <p className="mt-4 max-w-prose text-[17px] leading-relaxed text-[--ink-muted]">
          Skill Forge opens wider soon. Until{' '}
          <strong className="text-[--ink]">{preProgram.deadlineLabel}</strong>, create
          your account and you become a founding tester. The perk is decided once, at
          sign-up: an account created inside the window keeps the badge and the raised
          limit for good, while an account created after the deadline never gets them.
          It is tied to the account you sign in with, so it is only yours if the
          username you use here is the one you sign in with.
        </p>

        <div className="mt-8 rounded-2xl border border-[--accent] bg-[--accent-soft] px-5 py-4">
          <p className="text-sm text-[--ink]">
            <strong>Deadline:</strong> {preProgram.deadlineLabel}. Accounts created on
            or before that date keep the badge and the raised limit permanently;
            accounts created after it are ordinary members.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[--ink]">
            What you get
          </h2>
          <ul className="mt-5 space-y-4">
            {perks.map((perk) => (
              <li key={perk.title} className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-4">
                <p className="font-medium text-[--ink]">{perk.title}</p>
                <p className="mt-1 text-sm text-[--ink-muted]">{perk.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[--ink]">
            How to enter
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-[15px] text-[--ink]">
            <li>Sign in with your GitHub account, the same username you want the badge on.</li>
            <li>Generate or publish at least one skill, so the account is real.</li>
            <li>That is it: the badge and the raised limit appear on your dashboard.</li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[--ink]">
            Start now
          </h2>
          {status === 'authenticated' && session?.user ? (
            <p className="mt-4 text-[15px] text-[--ink]">
              You are signed in as <strong>@{session.user.login ?? session.user.name}</strong>.
              Open your{' '}
              <Link href="/dashboard" className="text-[--accent] underline underline-offset-2">
                dashboard
              </Link>{' '}
              to see your role.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
                className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Sign in with GitHub
              </button>
              <Link
                href="/demo"
                className="rounded-xl border border-[--line] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:border-[--accent]"
              >
                Try the demo first
              </Link>
            </div>
          )}
        </section>

        <p className="mt-10 max-w-prose text-sm text-[--ink-muted]">
          One account per person. The badge is granted from the username you sign in
          with, so a different username does not qualify. Skill Forge is free; the
          program only adds perks, it does not change the price.
        </p>
      </main>
      <Footer />
    </>
  );
}
