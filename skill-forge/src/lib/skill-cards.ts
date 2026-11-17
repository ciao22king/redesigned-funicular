import type { SkillSummary } from './marketplace';
import type { D1Like } from './d1';
import type { CreatorStats } from './creator';
import {
  avatarFor,
  displayNameFor,
  emptyProfile,
  publicProfileBadges,
  type CreatorProfile,
  type PublicProfileBadge,
} from './profile';
import { creatorStatsFor, featuredOwners } from './creator-db';
import { profilesFor } from './profile-db';
import { rolesFor } from './users-db';
import { downloadsForSkills } from './metrics-db';

/**
 * The skill card: what a list of skills shows about each one.
 *
 * A card is a small, repeated unit, so everything here is decided in one place
 * and loaded in a fixed number of queries — never one per card. The badge rule
 * is the same `publicProfileBadges` the profile page uses, only capped, so a
 * card can never claim a badge the profile would not.
 */

/** A card shows a handful of badges at most: more becomes noise. */
export const MAX_CARD_BADGES = 3;

/**
 * Which badges survive the cap, most meaningful first.
 *
 * The earned ones (featured, top author, verified) come before the quiet
 * "founding creator", so the one badge that is dropped when a creator has all
 * four is the least informative of them.
 */
const CARD_BADGE_ORDER: PublicProfileBadge['id'][] = [
  'featured',
  'top-author',
  'verified',
  'founding',
];

/**
 * The badges for a card, capped and ordered.
 *
 * Pure and total: an unknown id sorts last, and the cap is applied to a copy, so
 * the caller's array is never mutated.
 */
export function cardBadges(
  badges: PublicProfileBadge[],
  max = MAX_CARD_BADGES,
): PublicProfileBadge[] {
  const rank = new Map(CARD_BADGE_ORDER.map((id, i) => [id, i]));
  return [...badges]
    .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
    .slice(0, Math.max(0, max));
}

/** Everything one skill card renders. */
export interface SkillCardData {
  id: string;
  owner: string;
  name: string;
  description: string;
  tags: string[];
  category: string;
  stars: number;
  downloads: number;
  updatedAt: string;
  authorName: string;
  avatar: string;
  badges: PublicProfileBadge[];
}

const ZERO_STATS: CreatorStats = { published: 0, stars: 0, downloads: 0 };

/**
 * Turns a page of skill summaries into card data.
 *
 * The five lookups (profiles, author stats, featured, roles, downloads) run
 * together and cover every row at once, so a grid of twenty cards costs five
 * queries rather than twenty times five. Each source degrades on its own: a
 * missing profile falls back to the login, missing stats to zeros, so a broken
 * read still renders a card instead of failing the page.
 */
export async function skillCardsFor(
  rows: SkillSummary[],
  injected?: D1Like,
): Promise<SkillCardData[]> {
  if (rows.length === 0) return [];

  const owners = [...new Set(rows.map((r) => r.owner))];
  const ids = rows.map((r) => r.id);

  const [profiles, stats, featured, roles, downloads] = await Promise.all([
    profilesFor(owners, injected),
    creatorStatsFor(owners, injected),
    featuredOwners(owners, injected),
    rolesFor(owners, injected),
    downloadsForSkills(ids, injected),
  ]);

  return rows.map((row) => {
    const profile: CreatorProfile = profiles.get(row.owner) ?? emptyProfile(row.owner);
    const authorStats = stats.get(row.owner) ?? ZERO_STATS;
    const role = roles.get(row.owner);
    const badges = cardBadges(
      publicProfileBadges(authorStats, {
        founding: role === 'founding_tester' || role === 'owner',
        verified: profile.verified,
        featured: featured.has(row.owner),
      }),
    );

    return {
      id: row.id,
      owner: row.owner,
      name: row.name,
      description: row.description,
      tags: row.tags,
      category: row.category,
      stars: Number(row.stars) || 0,
      downloads: downloads.get(row.id) ?? 0,
      updatedAt: row.updatedAt,
      authorName: displayNameFor(row.owner, profile),
      avatar: avatarFor(row.owner, profile),
      badges,
    };
  });
}
