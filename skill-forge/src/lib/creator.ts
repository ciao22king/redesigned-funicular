/**
 * Creator programme: badges, featured placement and personal stats.
 *
 * The rules are pure and live here so the badge a person sees on their profile
 * is the same one the homepage uses to decide who to feature. There is no
 * manual curation list: the tiers are computed from published work, which keeps
 * the programme honest and reproducible.
 */

export interface CreatorStats {
  /** Skills currently published. */
  published: number;
  /** Stars across all of them. */
  stars: number;
  /** Downloads, summed from the metrics. */
  downloads: number;
}

/** A badge: a stable id, a label and what it took to earn it. */
export interface Badge {
  id: 'newcomer' | 'contributor' | 'maker' | 'featured';
  label: string;
  description: string;
}

/**
 * Thresholds, in one place. Raising one changes both the badge and the featured
 * list, because both read from here.
 */
export const CREATOR_TIERS = {
  /** One published skill earns the first badge. */
  contributor: { published: 1, stars: 0 },
  /** A small body of work that people have actually starred. */
  maker: { published: 3, stars: 10 },
} as const;

/** Minimum stars for a skill to be considered for the homepage. */
export const FEATURED_MIN_STARS = 5;

const BADGES: Record<Badge['id'], Badge> = {
  newcomer: {
    id: 'newcomer',
    label: 'Newcomer',
    description: 'You have not published a skill yet. Your first one starts here.',
  },
  contributor: {
    id: 'contributor',
    label: 'Contributor',
    description: 'You have published at least one skill the community can use.',
  },
  maker: {
    id: 'maker',
    label: 'Maker',
    description: 'A body of published work, with stars from real users.',
  },
  featured: {
    id: 'featured',
    label: 'Featured',
    description: 'One of your skills is on the homepage.',
  },
};

/**
 * The badge for a creator, from the strongest tier downwards. `featured` is
 * passed in rather than derived, because being featured is a property of a
 * skill, not of the totals.
 */
export function badgeFor(stats: CreatorStats, featured = false): Badge {
  if (featured) return BADGES.featured;
  if (stats.published >= CREATOR_TIERS.maker.published && stats.stars >= CREATOR_TIERS.maker.stars) {
    return BADGES.maker;
  }
  if (stats.published >= CREATOR_TIERS.contributor.published) return BADGES.contributor;
  return BADGES.newcomer;
}

/** All badges, in ascending order, so a profile can show the whole ladder. */
export function allBadges(): Badge[] {
  return [BADGES.newcomer, BADGES.contributor, BADGES.maker, BADGES.featured];
}

/** How far the creator is from the next badge, for a progress line. */
export function nextTier(stats: CreatorStats): { badge: Badge; missing: string } | null {
  if (
    stats.published < CREATOR_TIERS.maker.published ||
    stats.stars < CREATOR_TIERS.maker.stars
  ) {
    const needSkills = Math.max(0, CREATOR_TIERS.maker.published - stats.published);
    const needStars = Math.max(0, CREATOR_TIERS.maker.stars - stats.stars);
    const parts: string[] = [];
    if (needSkills > 0) parts.push(`${needSkills} more ${needSkills === 1 ? 'skill' : 'skills'}`);
    if (needStars > 0) parts.push(`${needStars} more ${needStars === 1 ? 'star' : 'stars'}`);
    return { badge: BADGES.maker, missing: parts.join(' and ') };
  }
  return null;
}

export interface FeaturedCandidate {
  id: string;
  name: string;
  description: string;
  owner: string;
  stars: number;
  tags?: string[];
}

/**
 * Picks the skills shown on the homepage: the most starred above the threshold,
 * newest first among equals, and never more than `limit`.
 *
 * It is a pure selection over rows the caller already has, so the homepage does
 * not run a second, special query that could disagree with the marketplace.
 */
export function pickFeatured<T extends FeaturedCandidate>(
  skills: T[],
  limit = 3,
): T[] {
  return skills
    .filter((s) => Number(s.stars) >= FEATURED_MIN_STARS)
    .sort((a, b) => Number(b.stars) - Number(a.stars) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}

/** True when this skill is on the homepage, used to show the featured badge. */
export function isFeatured(stars: number): boolean {
  return Number(stars) >= FEATURED_MIN_STARS;
}
