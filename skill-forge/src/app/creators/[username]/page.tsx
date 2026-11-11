import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { SkillGrid } from '@/components/SkillGrid';
import { CreatorBadges } from '@/components/CreatorBadges';
import { ProfileReport } from '@/components/ProfileReport';
import { countSkills, listSkills } from '@/lib/marketplace-db';
import { toSummary } from '@/lib/marketplace';
import { creatorLastActivity, creatorStats, isFeaturedAuthor, manualBadgesFor } from '@/lib/creator-db';
import { getProfile } from '@/lib/profile-db';
import { readRole } from '@/lib/users-db';
import {
  avatarFor,
  displayNameFor,
  githubUrl,
  isProfileIndexable,
  publicProfileBadges,
  socialLinksFor,
} from '@/lib/profile';
import { creatorStatus, creatorStatusLabel } from '@/lib/admin';
import { siteBase } from '@/lib/site-url';
import { legal } from '@/lib/legal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  username: string;
}

/** GitHub logins are alphanumeric with single hyphens, up to 39 chars. */
const OWNER_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/**
 * Loads everything the profile page shows.
 *
 * The numbers are derived from the published work, never stored: the same
 * `creatorStats` the dashboard uses, so a creator's public page and their own
 * dashboard cannot disagree. A missing binding or an unknown login yields null
 * and the page answers 404, which is also what an empty profile gets.
 */
async function load(username: string) {
  if (!OWNER_RE.test(username)) return null;
  try {
    const [profile, stats, featured, lastActivity, rows, total, role, manual] = await Promise.all([
      getProfile(username),
      creatorStats(username),
      isFeaturedAuthor(username),
      creatorLastActivity(username),
      listSkills({ owner: username, sort: 'recent', limit: 100 }),
      countSkills({ owner: username }),
      readRole(username),
      manualBadgesFor([username]).catch(() => new Map<string, string[]>()),
    ]);
    if (total === 0) return null;
    return {
      username,
      profile,
      stats,
      featured,
      lastActivity,
      total,
      role,
      manual: manual.get(username) ?? [],
      skills: rows.map((r) => toSummary(r)),
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username } = await params;
  const data = await load(username);
  if (!data) return { title: 'Creator not found · Skill Forge' };

  const name = displayNameFor(username, data.profile);
  const title = `${name} (@${username}) · Skill Forge`;
  const description =
    data.profile.bio ||
    `Skills for AI agents published by @${username} on Skill Forge.`;

  return {
    title,
    description,
    alternates: { canonical: `/creators/${username}` },
    // A suspended or banned profile must not be indexed, even though its page
    // answers so that an existing link keeps working.
    robots: isProfileIndexable({
      published: data.total,
      suspended: data.profile.suspended,
      banned: data.profile.banned,
    })
      ? undefined
      : { index: false, follow: false },
    openGraph: { type: 'profile', title, description, siteName: 'Skill Forge' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function CreatorPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await load(username);
  if (!data) notFound();

  const { profile, stats, skills } = data;
  const name = displayNameFor(username, profile);
  const avatar = avatarFor(username, profile);
  const badges = publicProfileBadges(stats, {
    founding: data.role === 'founding_tester' || data.role === 'owner',
    verified: profile.verified,
    featured: data.featured,
    manual: data.manual,
  });
  const links = socialLinksFor(username, profile);
  const hidden = creatorStatus(profile) !== 'active';
  const base = await siteBase();

  // Structured data: the same entity the JSON-LD on the site root names, with
  // the profile's own links so search engines tie the two together.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `${base}/creators/${username}`,
    mainEntity: {
      '@type': 'Person',
      name,
      alternateName: `@${username}`,
      description: profile.bio || undefined,
      image: avatar,
      url: `${base}/creators/${username}`,
      sameAs: links.filter((l) => l.key !== 'github').map((l) => l.url),
    },
    isPartOf: { '@type': 'WebSite', name: legal.siteName, url: legal.siteUrl },
  };

  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-5xl px-6 py-14">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {hidden ? (
          <div className="rounded-2xl border border-[--line] bg-[--surface-raised] p-8">
            <h1 className="font-display text-2xl font-semibold text-[--ink]">
              This profile is unavailable
            </h1>
            <p className="mt-3 max-w-prose text-[--ink-muted]">
              The profile of @{username} is not shown while it is{' '}
              {creatorStatus(profile) === 'banned' ? 'banned' : 'under review'}. The
              published skills remain available from the marketplace.
            </p>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-start gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt=""
                width={96}
                height={96}
                className="h-24 w-24 rounded-full border border-[--line] bg-[--surface-raised]"
              />
              <div className="min-w-0 flex-1">
                <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[--ink-muted]">
                  Creator
                </p>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
                  {name}
                </h1>
                <p className="mt-1 text-sm text-[--ink-muted]">@{username}</p>

                {badges.length > 0 && (
                  <div className="mt-4">
                    <CreatorBadges badges={badges} />
                  </div>
                )}

                {profile.bio && (
                  <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-[--ink-muted]">
                    {profile.bio}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a
                    href={githubUrl(username)}
                    target="_blank"
                    rel="me noopener noreferrer"
                    className="rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-2.5 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
                  >
                    View GitHub profile
                  </a>
                  {links
                    .filter((l) => l.key !== 'github')
                    .map((l) => (
                      <a
                        key={l.key}
                        href={l.url}
                        target="_blank"
                        rel="me noopener noreferrer"
                        className="rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-2.5 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
                      >
                        {l.label}
                      </a>
                    ))}
                </div>
              </div>
            </header>

            <div className="hairline my-10" />

            <section aria-label="Stats" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Skills" value={String(stats.published)} />
              <Stat label="Downloads" value={String(stats.downloads)} />
              <Stat label="Stars" value={String(stats.stars)} />
              <Stat
                label="Last activity"
                value={data.lastActivity ? new Date(data.lastActivity).toLocaleDateString('en-US') : '—'}
              />
            </section>

            <div className="hairline my-10" />

            <h2 className="font-display text-xl font-semibold text-[--ink]">
              Skills by @{username}
            </h2>
            <SkillGrid skills={skills} />

            <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-[--ink-muted]">
                <Link
                  href="/marketplace"
                  className="text-[--accent] underline underline-offset-2"
                >
                  Browse the full marketplace
                </Link>
              </p>
              <ProfileReport username={username} />
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[--surface-sunken] px-4 py-3">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-[--ink]">{value}</dd>
    </div>
  );
}
