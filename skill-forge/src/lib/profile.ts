/**
 * Public creator profiles: the editable part, the badges and the visibility
 * rules.
 *
 * Everything here is pure, so the badge a visitor sees, the fields the editor
 * accepts and the decision to list a profile in the sitemap are all decided by
 * the same functions, and all testable without a database or a browser.
 *
 * The numbers on a profile are not stored: they are derived from the published
 * skills (see `creator-db.ts`). Only what a person writes about themselves
 * (name, bio, avatar, links) and the moderation flags live in the `profiles`
 * row.
 */

import { sanitizeField, sanitizePublicText } from './sanitize';
import type { CreatorStats } from './creator';

/** Caps, in one place, so the editor and the server agree on the limits. */
export const PROFILE_LIMITS = {
  displayName: 60,
  bio: 280,
  url: 300,
} as const;

/** The links a creator may add, besides the GitHub one derived from the login. */
export const SOCIAL_KEYS = ['x', 'linkedin', 'youtube', 'website', 'newsletter'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface SocialMeta {
  key: SocialKey;
  label: string;
  /**
   * Where a bare handle goes. Empty for a free-form link, which must then be a
   * domain or a full URL.
   */
  base: string;
}

export const SOCIALS: SocialMeta[] = [
  { key: 'x', label: 'X', base: 'https://x.com/' },
  { key: 'linkedin', label: 'LinkedIn', base: 'https://www.linkedin.com/in/' },
  { key: 'youtube', label: 'YouTube', base: 'https://www.youtube.com/@' },
  { key: 'website', label: 'Website', base: '' },
  { key: 'newsletter', label: 'Newsletter', base: '' },
];

const SOCIAL_BY_KEY: Record<SocialKey, SocialMeta> = Object.fromEntries(
  SOCIALS.map((s) => [s.key, s]),
) as Record<SocialKey, SocialMeta>;

/** Raw fields as they arrive from the editor. Every field is optional. */
export interface ProfileInput {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  x?: string;
  linkedin?: string;
  youtube?: string;
  website?: string;
  newsletter?: string;
}

export interface NormalizedProfile {
  displayName: string;
  bio: string;
  avatarUrl: string;
  socials: Record<SocialKey, string>;
}

export interface ProfileValidation {
  ok: boolean;
  error?: string;
  value?: NormalizedProfile;
}

/** A profile as read back from storage, with the moderation flags. */
export interface CreatorProfile {
  login: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  x: string;
  linkedin: string;
  youtube: string;
  website: string;
  newsletter: string;
  verified: boolean;
  suspended: boolean;
  /** False when the person has never saved a profile: the defaults are in use. */
  hasRow: boolean;
  updatedAt: string;
}

/** The profile of someone who never edited theirs. */
export function emptyProfile(login: string): CreatorProfile {
  return {
    login,
    displayName: '',
    bio: '',
    avatarUrl: '',
    x: '',
    linkedin: '',
    youtube: '',
    website: '',
    newsletter: '',
    verified: false,
    suspended: false,
    hasRow: false,
    updatedAt: '',
  };
}

const HAS_SCHEME = /^https?:\/\//i;
// `example.com`, `example.com/path`, `sub.example.co.uk`: something with a dot
// and a plausible TLD, which a bare handle (letters, digits, `_`, `-`) is not.
const DOMAINISH = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i;

/**
 * Turns what a person typed into a link, or an empty string when it is not one.
 *
 * Three accepted shapes: a full `http(s)://` URL, a bare domain (which gets
 * `https://`), or a handle (which is appended to the platform's base). An empty
 * result means "not a link", which the caller turns into a validation error
 * unless the field was empty to begin with.
 */
export function normalizeSocialUrl(raw: string | undefined, key: SocialKey): string {
  const cleaned = sanitizePublicText(raw ?? '').replace(/\s+/g, '');
  if (!cleaned) return '';
  const value = cleaned.replace(/^@/, '');
  if (HAS_SCHEME.test(value)) return value.slice(0, PROFILE_LIMITS.url);
  if (DOMAINISH.test(value)) return `https://${value}`.slice(0, PROFILE_LIMITS.url);
  const base = SOCIAL_BY_KEY[key]?.base;
  if (base) return `${base}${value.replace(/^\/+/, '')}`.slice(0, PROFILE_LIMITS.url);
  return '';
}

/** Same rules as a social link, without a platform to fall back to. */
export function normalizeAvatarUrl(raw: string | undefined): string {
  const cleaned = sanitizePublicText(raw ?? '').replace(/\s+/g, '');
  if (!cleaned) return '';
  if (HAS_SCHEME.test(cleaned)) return cleaned.slice(0, PROFILE_LIMITS.url);
  if (DOMAINISH.test(cleaned)) return `https://${cleaned}`.slice(0, PROFILE_LIMITS.url);
  return '';
}

/**
 * Validates and normalizes a profile from the editor.
 *
 * A field left empty clears it; a field with something that is not a link is
 * refused with the name of the field, so the person knows what to fix instead
 * of losing the whole form.
 */
export function validateProfileInput(input: ProfileInput): ProfileValidation {
  const displayName = sanitizeField(input.displayName, PROFILE_LIMITS.displayName);
  const bio = sanitizeField(input.bio, PROFILE_LIMITS.bio);

  const rawAvatar = (input.avatarUrl ?? '').trim();
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl);
  if (rawAvatar && !avatarUrl) {
    return { ok: false, error: 'The avatar link is not a valid URL.' };
  }

  const socials = {} as Record<SocialKey, string>;
  for (const social of SOCIALS) {
    const raw = input[social.key];
    const url = normalizeSocialUrl(raw, social.key);
    if ((raw ?? '').trim() && !url) {
      return { ok: false, error: `The ${social.label} link is not a valid URL.` };
    }
    socials[social.key] = url;
  }

  return { ok: true, value: { displayName, bio, avatarUrl, socials } };
}

/** Flattens a stored profile into the shape the editor form edits. */
export function toProfileInput(profile: CreatorProfile): ProfileInput {
  return {
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    x: profile.x,
    linkedin: profile.linkedin,
    youtube: profile.youtube,
    website: profile.website,
    newsletter: profile.newsletter,
  };
}

/** The name to show: what the person chose, or their login. */
export function displayNameFor(login: string, profile: Pick<CreatorProfile, 'displayName'>): string {
  return profile.displayName?.trim() || login;
}

/** The avatar to show: a custom one, or GitHub's, which always exists. */
export function avatarFor(login: string, profile: Pick<CreatorProfile, 'avatarUrl'>): string {
  return profile.avatarUrl?.trim() || `https://avatars.githubusercontent.com/${login}`;
}

/** The public GitHub page of a creator. Always present, from the login. */
export function githubUrl(login: string): string {
  return `https://github.com/${login}`;
}

export interface SocialLink {
  key: string;
  label: string;
  url: string;
}

/**
 * The links to show on a profile, GitHub first and then whatever the person
 * filled in. Empty fields simply do not appear.
 */
export function socialLinksFor(
  login: string,
  profile: Pick<CreatorProfile, SocialKey | 'displayName'>,
): SocialLink[] {
  const links: SocialLink[] = [{ key: 'github', label: 'GitHub', url: githubUrl(login) }];
  for (const social of SOCIALS) {
    const url = profile[social.key];
    if (url) links.push({ key: social.key, label: social.label, url });
  }
  return links;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface PublicProfileBadge {
  id: 'founding' | 'verified' | 'top-author' | 'featured';
  label: string;
  description: string;
  /** `strong` wears the accent; `quiet` is a bordered pill like the role badge. */
  tone: 'strong' | 'quiet';
}

/** A body of published work the community has actually starred. */
export const TOP_AUTHOR = { published: 5, stars: 50 } as const;

export function isTopAuthor(stats: CreatorStats): boolean {
  return stats.published >= TOP_AUTHOR.published && stats.stars >= TOP_AUTHOR.stars;
}

const BADGE = {
  founding: {
    id: 'founding',
    label: 'Founding creator',
    description: 'Joined while Skill Forge was still being built.',
    tone: 'quiet',
  },
  verified: {
    id: 'verified',
    label: 'Verified',
    description: 'Identity confirmed by the maintainers.',
    tone: 'strong',
  },
  'top-author': {
    id: 'top-author',
    label: 'Top author',
    description: 'A body of published work the community stars.',
    tone: 'strong',
  },
  featured: {
    id: 'featured',
    label: 'Featured',
    description: 'One of their skills is on the homepage.',
    tone: 'strong',
  },
} satisfies Record<PublicProfileBadge['id'], PublicProfileBadge>;

/**
 * The badges shown on a public profile, in a fixed order.
 *
 * Each one has to be earned from a fact the service can see: the account's age
 * (founding), a stored moderation flag (verified), the published work (top
 * author) or the homepage (featured). Nothing is curated by hand, so the badges
 * cannot drift from the numbers.
 */
export function publicProfileBadges(
  stats: CreatorStats,
  opts: { founding?: boolean; verified?: boolean; featured?: boolean } = {},
): PublicProfileBadge[] {
  const badges: PublicProfileBadge[] = [];
  if (opts.founding) badges.push(BADGE.founding);
  if (opts.verified) badges.push(BADGE.verified);
  if (isTopAuthor(stats)) badges.push(BADGE['top-author']);
  if (opts.featured) badges.push(BADGE.featured);
  return badges;
}

/**
 * Whether a profile may be listed in the sitemap and the creators directory.
 *
 * An empty profile (no published skills) is not a destination worth indexing,
 * and a suspended one must disappear from discovery without deleting the
 * account. The page itself still answers, so a link someone already has keeps
 * working.
 */
export function isProfileIndexable(input: { published: number; suspended: boolean }): boolean {
  return input.published > 0 && !input.suspended;
}

// ---------------------------------------------------------------------------
// Reporting a profile
// ---------------------------------------------------------------------------

/** Why a profile was reported. Closed set, like the skill reports. */
export const PROFILE_REPORT_REASONS = [
  'impersonation',
  'spam',
  'harmful',
  'misleading',
  'other',
] as const;
export type ProfileReportReason = (typeof PROFILE_REPORT_REASONS)[number];

export interface ProfileReportInput {
  username?: string;
  reason?: string;
  note?: string;
}

export interface NormalizedProfileReport {
  username: string;
  reason: ProfileReportReason;
  note: string;
}

export interface ProfileReportValidation {
  ok: boolean;
  error?: string;
  value?: NormalizedProfileReport;
}

const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isProfileReportReason(value: string): value is ProfileReportReason {
  return (PROFILE_REPORT_REASONS as readonly string[]).includes(value);
}

/** Validates a report about a profile. The username must be a real login. */
export function validateProfileReport(input: ProfileReportInput): ProfileReportValidation {
  const username = (input.username ?? '').trim();
  if (!LOGIN_RE.test(username)) {
    return { ok: false, error: 'Invalid username.' };
  }
  const reason = (input.reason ?? '').trim();
  if (!isProfileReportReason(reason)) {
    return { ok: false, error: 'Choose a reason for the report.' };
  }
  const note = sanitizePublicText(input.note ?? '').slice(0, 500);
  return { ok: true, value: { username, reason, note } };
}

/** Label shown for a reason, so the UI and the stored value cannot drift. */
export function profileReasonLabel(reason: ProfileReportReason): string {
  switch (reason) {
    case 'impersonation':
      return 'Impersonation or a fake account';
    case 'spam':
      return 'Spam or advertising';
    case 'harmful':
      return 'Harmful or abusive content';
    case 'misleading':
      return 'Misleading or wrong';
    default:
      return 'Something else';
  }
}
