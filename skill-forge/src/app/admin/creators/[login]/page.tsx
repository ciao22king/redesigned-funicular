import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminCreators, adminSkills } from '@/lib/admin-db';
import { manualBadgesFor, creatorStats, isFeaturedAuthor } from '@/lib/creator-db';
import { getProfile } from '@/lib/profile-db';
import { readRole } from '@/lib/users-db';
import { avatarFor, displayNameFor, publicProfileBadges, SOCIALS } from '@/lib/profile';
import { creatorStatus, creatorStatusLabel, skillStatusLabel } from '@/lib/admin';
import { AdminCreatorActions } from '@/components/AdminCreatorActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/**
 * One creator, in full: profile, badges, social links, stats and their skills.
 *
 * The page is a server component; the moderation controls are a small client
 * component that posts to the admin API and refreshes, so the view always
 * reflects stored state.
 */
export default async function AdminCreatorDetail({
  params,
}: {
  params: Promise<{ login: string }>;
}) {
  const { login } = await params;
  if (!OWNER_RE.test(login)) notFound();

  let data: {
    profile: Awaited<ReturnType<typeof getProfile>>;
    stats: Awaited<ReturnType<typeof creatorStats>>;
    featured: boolean;
    role: string;
    badges: string[];
    skills: Awaited<ReturnType<typeof adminSkills>>;
  } | null = null;
  try {
    const [profile, stats, featured, role, badges, skills] = await Promise.all([
      getProfile(login),
      creatorStats(login),
      isFeaturedAuthor(login),
      readRole(login),
      manualBadgesFor([login]),
      adminSkills({ owner: login, status: 'all', limit: 500 }),
    ]);
    data = { profile, stats, featured, role, badges: badges.get(login) ?? [], skills };
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main id="content" className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-[--ink-muted]">The database is unreachable right now.</p>
      </main>
    );
  }

  const { profile, stats, featured, role, badges, skills } = data;
  const name = displayNameFor(login, profile);
  const avatar = avatarFor(login, profile);
  const standing = creatorStatus(profile);
  const publicBadges = publicProfileBadges(stats, {
    founding: role === 'founding_tester' || role === 'owner',
    verified: profile.verified,
    featured,
    manual: badges,
  });

  return (
    <main id="content" className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin/creators" className="text-sm text-[--ink-muted] hover:text-[--ink]">
        ← Creators
      </Link>

      <header className="mt-4 flex flex-wrap items-start gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt=""
          width={72}
          height={72}
          className="h-18 w-18 rounded-full border border-[--line] bg-[--surface-raised]"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[--ink]">
            {name}
          </h1>
          <p className="mt-1 text-sm text-[--ink-muted]">
            @{login} · <span className="font-medium">{creatorStatusLabel(standing)}</span> ·{' '}
            {role}
          </p>
          {publicBadges.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {publicBadges.map((b) => (
                <li
                  key={b.id}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    b.tone === 'strong'
                      ? 'border-[--accent] bg-[--accent-soft] text-[--accent]'
                      : 'border-[--line] bg-[--surface-raised] text-[--ink-muted]'
                  }`}
                >
                  {b.label}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-[--ink-muted]">
            <Link href={`/creators/${login}`} className="text-[--accent] underline underline-offset-2">
              Public profile
            </Link>{' '}
            ·{' '}
            <a
              href={`https://github.com/${login}`}
              target="_blank"
              rel="noreferrer"
              className="text-[--accent] underline underline-offset-2"
            >
              GitHub
            </a>
          </p>
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Published" value={stats.published} />
        <Stat label="Stars" value={stats.stars} />
        <Stat label="Downloads" value={stats.downloads} />
        <Stat label="Skills (all)" value={skills.length} />
      </dl>

      <div className="hairline my-10" />

      <AdminCreatorActions
        login={login}
        verified={profile.verified}
        status={standing}
        manualBadges={badges}
        socials={SOCIALS.map((s) => ({ key: s.key, label: s.label }))}
        verifiedSocials={profile.verifiedSocials}
      />

      <div className="hairline my-10" />

      <section>
        <h2 className="font-display text-xl font-semibold text-[--ink]">Skills</h2>
        {skills.length === 0 ? (
          <p className="mt-3 text-sm text-[--ink-muted]">This creator has no skills.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[--line] text-left text-[--ink-muted]">
                  <th className="py-2 pr-4 font-medium">Skill</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Stars</th>
                  <th className="py-2 pr-4 text-right font-medium">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => (
                  <tr key={s.id} className="border-b border-[--line]">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/skills?q=${encodeURIComponent(s.id)}`}
                        className="font-medium text-[--ink] hover:text-[--accent]"
                      >
                        {s.name}
                      </Link>
                      <span className="block text-xs text-[--ink-muted]">{s.id}</span>
                    </td>
                    <td className="py-3 pr-4 text-[--ink-muted]">{skillStatusLabel(s.status)}</td>
                    <td className="py-3 pr-4 text-right font-mono text-[--ink]">{s.stars}</td>
                    <td className="py-3 pr-4 text-right font-mono text-[--ink]">{s.downloads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[--line] bg-[--surface-raised] px-4 py-3">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-[--ink]">{value}</dd>
    </div>
  );
}
