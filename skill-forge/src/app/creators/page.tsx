import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { creatorSummaries } from '@/lib/creator-db';
import { profilesFor, suspendedLogins } from '@/lib/profile-db';
import { avatarFor, displayNameFor, isTopAuthor } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Creators · Skill Forge',
  description: 'The people publishing skills for AI agents on Skill Forge.',
  alternates: { canonical: '/creators' },
};

/**
 * The creators directory: everyone with at least one published skill, most
 * starred first. Suspended profiles are left out, and an author who has
 * published nothing has no row here at all, so the list only ever holds real
 * creators.
 */
export default async function CreatorsPage() {
  let creators: { owner: string; published: number; stars: number }[] = [];
  let suspended = new Set<string>();
  let profiles = new Map<string, { displayName: string; avatarUrl: string }>();
  try {
    const rows = await creatorSummaries();
    suspended = await suspendedLogins();
    profiles = await profilesFor(rows.map((r) => r.owner));
    creators = rows.filter((r) => !suspended.has(r.owner));
  } catch {
    creators = [];
  }

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
          Creators
        </h1>
        <p className="mt-4 max-w-prose text-[17px] text-[--ink-muted]">
          The people who turn their notes into skills an agent can follow. Open a
          profile to see everything they have published.
        </p>

        {creators.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[--line] bg-[--surface-raised] p-8 text-center">
            <p className="font-display text-lg font-semibold text-[--ink]">
              No creators yet
            </p>
            <p className="mt-2 text-sm text-[--ink-muted]">
              Be the first to{' '}
              <Link href="/create/from-skills" className="text-[--accent] underline underline-offset-2">
                publish a skill
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((c) => {
              const profile = profiles.get(c.owner) ?? { displayName: '', avatarUrl: '' };
              const name = displayNameFor(c.owner, profile);
              const avatar = avatarFor(c.owner, profile);
              const top = isTopAuthor({ published: c.published, stars: c.stars, downloads: 0 });
              return (
                <li key={c.owner}>
                  <Link
                    href={`/creators/${c.owner}`}
                    className="flex h-full items-center gap-4 rounded-2xl border border-[--line] bg-[--surface-raised] p-5 transition-colors hover:border-[--accent]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatar}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full border border-[--line] bg-[--surface-sunken]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-display text-base font-semibold text-[--ink]">
                          {name}
                        </span>
                        {top && (
                          <span className="shrink-0 rounded-full border border-[--accent] bg-[--accent-soft] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[--accent]">
                            Top
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[--ink-muted]">
                        @{c.owner}
                      </span>
                      <span className="mt-1 block text-xs text-[--ink-muted]">
                        {c.published} {c.published === 1 ? 'skill' : 'skills'} · ★ {c.stars}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-12 text-sm text-[--ink-muted]">
          <Link href="/marketplace" className="text-[--accent] underline underline-offset-2">
            Browse the full marketplace
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
