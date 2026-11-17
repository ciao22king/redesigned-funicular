import {
  getPublicSkill,
  getSkillBySlug,
  listVersions,
  relatedSkills,
} from './marketplace-db';
import { skillId, toSummary, toDetail } from './marketplace';
import { skillCounters } from './metrics-db';
import { creatorStats, isFeaturedAuthor, manualBadgesFor } from './creator-db';
import { getProfile } from './profile-db';
import { readRole } from './users-db';
import { avatarFor, displayNameFor, publicProfileBadges, socialLinksFor } from './profile';
import { pickRelated } from './skill-page';
import type { SkillPageData } from '@/components/SkillDetailView';

/** GitHub logins are alphanumeric with single hyphens, up to 39 chars. */
const OWNER_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/**
 * Loads everything a skill page shows, in one round of queries.
 *
 * Shared by the page route and the short-URL redirect so the two cannot disagree
 * about what exists. A missing D1 binding or an unknown skill yields null, which
 * the callers turn into a 404 instead of a broken render.
 */
export async function loadSkillPage(
  owner: string,
  slug: string,
): Promise<SkillPageData | null> {
  if (!OWNER_RE.test(owner) || !slug) return null;
  try {
    const id = skillId(owner, slug);
    // Public read: a skill the operator rejected or removed resolves to null,
    // so its page answers 404 like any other missing skill.
    const row = await getPublicSkill(id);
    if (!row) return null;

    const detail = toDetail(row);
    const [profile, stats, featured, counters, versions, relatedRows, role, manual] =
      await Promise.all([
        getProfile(owner),
        creatorStats(owner),
        isFeaturedAuthor(owner),
        skillCounters(id).catch(() => ({ downloads: 0, copies: 0 })),
        listVersions(id).catch(() => []),
        relatedSkills({ id, tags: detail.tags, category: detail.category }, 8).catch(() => []),
        readRole(owner),
        manualBadgesFor([owner]).catch(() => new Map<string, string[]>()),
      ]);

    const related = pickRelated(
      relatedRows.map((r) => toSummary(r)),
      { id, tags: detail.tags, category: detail.category },
      4,
    );

    return {
      id,
      owner,
      slug,
      detail,
      profile,
      stats,
      counters,
      versions,
      related,
      authorName: displayNameFor(owner, profile),
      avatar: avatarFor(owner, profile),
      badges: publicProfileBadges(stats, {
        founding: role === 'founding_tester' || role === 'owner',
        verified: profile.verified,
        featured,
        manual: manual.get(owner) ?? [],
      }),
      authorLinks: socialLinksFor(owner, profile),
    };
  } catch {
    return null;
  }
}

/**
 * Resolves a one-segment `/skills/<slug>` request to its canonical owner/slug.
 *
 * The slug is not unique across authors, so an ambiguous one is refused rather
 * than guessed: the caller answers 404 and the canonical two-segment URL is the
 * one that always works.
 */
export async function resolveSlug(
  slug: string,
): Promise<{ owner: string; slug: string } | null> {
  try {
    const row = await getSkillBySlug(slug);
    return row ? { owner: row.owner, slug: row.slug } : null;
  } catch {
    return null;
  }
}
