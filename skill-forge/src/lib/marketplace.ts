import { readFrontmatterDescription, readFrontmatterName, slugify } from './skill';
import { MAX_OUTPUT_CHARS } from './guardrails';
import { sanitizeField } from './sanitize';

/**
 * Marketplace: pure logic, without database access.
 *
 * Everything that can be decided without touching D1 lives here (validation,
 * normalization, id composition), so it is verifiable with unit tests. The
 * queries live in `marketplace-db.ts`.
 */

/** Cap on tags per skill. */
export const MAX_TAGS = 6;
/** Maximum length of a tag. */
export const MAX_TAG_CHARS = 24;
/** Lunghezza massima di nome e descrizione. */
export const MAX_NAME_CHARS = 120;
export const MAX_DESCRIPTION_CHARS = 400;

export type SortKey = 'recent' | 'trending' | 'stars' | 'name';

/**
 * Trending score, computed in SQL.
 *
 * It is a "velocity" ranking, not a plain star count: a skill that is gaining
 * stars right now beats one that collected the same stars months ago. The
 * score is `(base + stars + VELOCITY_WEIGHT * recentStars) / (ageHours + 2)^GRAVITY`.
 *
 * - `recentStars`: stars gained in the last RECENT_WINDOW_DAYS.
 * - `base` (1) gives a brand-new skill with zero stars a small but non-zero
 *   score, so it can still surface instead of being buried forever.
 * - `ageHours + 2` avoids dividing by zero and tames the first minutes.
 * - `GRAVITY` > 1 makes older skills fall off faster than linearly.
 *
 * The constants live here so the UI and any future client cannot drift from
 * the server-side ordering: both read the same numbers.
 */
export const TRENDING = {
  /** Stars gained in this many days count as "recent". */
  RECENT_WINDOW_DAYS: 7,
  /** Weight of a recent star relative to an older one. */
  VELOCITY_WEIGHT: 5,
  /** Time-decay exponent. Higher = newer items dominate more. */
  GRAVITY: 1.5,
  /** Flat bonus so a zero-star skill still has a score. */
  BASE: 1,
} as const;

export interface SkillInput {
  name?: string;
  description?: string;
  markdown?: string;
  tags?: string[] | string;
}

export interface NormalizedSkill {
  slug: string;
  name: string;
  description: string;
  markdown: string;
  tags: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value?: NormalizedSkill;
}

/**
 * Public id of a skill: `owner/slug`. The slug alone is not unique, because two
 * different authors can have a skill with the same name.
 */
export function skillId(owner: string, slug: string): string {
  return `${owner}/${slug}`;
}

/** Splits a public id. Returns undefined if the format is not valid. */
export function parseSkillId(id: string): { owner: string; slug: string } | undefined {
  const idx = id.indexOf('/');
  if (idx <= 0 || idx === id.length - 1) return undefined;
  return { owner: id.slice(0, idx), slug: id.slice(idx + 1) };
}

/**
 * Normalizza i tag: separatore virgola o spazio, slug kebab-case, dedup,
 * count and length caps. Returns the string saved to D1.
 */
export function parseTags(input: string[] | string | undefined): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : input.split(/[,\s]+/);
  const seen = new Set<string>();
  for (const item of raw) {
    const tag = slugify(String(item)).slice(0, MAX_TAG_CHARS);
    if (tag && tag !== 'untitled-skill') seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}

/** Rebuilds the tag string saved to D1. */
export function serializeTags(tags: string[]): string {
  return tags.join(',');
}

/** Reads the tag string saved to D1. */
export function deserializeTags(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Normalizes a tag coming from a URL into the same kebab-case form used at
 * save time. Returns an empty string for anything that could not be a real tag,
 * so a caller can answer 404 instead of running a meaningless query.
 */
export function normalizeTag(value: string | null | undefined): string {
  const tag = slugify((value ?? '').trim()).slice(0, MAX_TAG_CHARS);
  return tag === 'untitled-skill' ? '' : tag;
}

/**
 * SQL clause that matches a skill carrying exactly this tag.
 *
 * Tags are stored as a comma-separated string, so a plain `LIKE '%git%'` would
 * also match `github`. Wrapping both the column and the term in commas turns it
 * into an exact element match.
 */
export function tagClause(tag: string | null | undefined): { sql: string; params: string[] } {
  const clean = normalizeTag(tag);
  if (!clean) return { sql: '', params: [] };
  return { sql: " AND (',' || tags || ',') LIKE ?", params: [`%,${clean},%`] };
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Counts how many skills carry each tag, most used first.
 *
 * The aggregation is done in JS over the `tags` column, not in SQL: the column
 * is a denormalized string, and splitting it in SQLite would need a recursive
 * CTE for no real gain at this size. The result feeds the tag index page.
 */
export function aggregateTags(rows: { tags: string }[], limit = 80): TagCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of deserializeTags(row.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, Math.max(0, limit));
}

/**
 * Validates and normalizes a skill coming from the client.
 *
 * Name and description, if missing, are read from the frontmatter: so a skill
 * generated by the app is published as is, without the client having to
 * re-extract the fields.
 *
 * Name and description become public on the skill page, the cards and the RSS
 * feed, so they are sanitised here: any markup is stripped and the whitespace is
 * collapsed. The markdown body is left as it is, because it is rendered through
 * the block parser in `markdown.ts`, which never produces HTML.
 */
export function validateSkillInput(input: SkillInput): ValidationResult {
  const markdown = (input.markdown ?? '').trim();

  if (!markdown) {
    return { ok: false, error: 'The skill is empty.' };
  }
  if (markdown.length > MAX_OUTPUT_CHARS) {
    return { ok: false, error: 'The skill is too long.' };
  }

  const rawName = (input.name ?? readFrontmatterName(markdown) ?? '').trim();
  if (!rawName) {
    return { ok: false, error: 'The skill has no name (`name` field).' };
  }
  if (rawName.length > MAX_NAME_CHARS) {
    return { ok: false, error: 'The skill name is too long.' };
  }
  const name = sanitizeField(rawName, MAX_NAME_CHARS);
  if (!name) {
    return { ok: false, error: 'The skill name contains only markup and was refused.' };
  }

  const rawDescription = (input.description ?? readFrontmatterDescription(markdown) ?? '').trim();
  if (rawDescription.length > MAX_DESCRIPTION_CHARS) {
    return { ok: false, error: 'The description is too long.' };
  }
  const description = sanitizeField(rawDescription, MAX_DESCRIPTION_CHARS);

  return {
    ok: true,
    value: {
      slug: slugify(name),
      name,
      description,
      markdown,
      tags: serializeTags(parseTags(input.tags)),
    },
  };
}

export interface SkillRow {
  id: string;
  slug: string;
  owner: string;
  name: string;
  description: string;
  markdown: string;
  tags: string;
  stars: number;
  created_at: string;
  updated_at: string;
}

/** Storefront version: without the heavy markdown body. */
export interface SkillSummary {
  id: string;
  owner: string;
  name: string;
  description: string;
  tags: string[];
  stars: number;
  createdAt: string;
  updatedAt: string;
}

/** Full version, with the markdown, for download and editing. */
export interface SkillDetail extends SkillSummary {
  markdown: string;
}

export function toSummary(row: SkillRow, starred = false): SkillSummary & { starred: boolean } {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    description: row.description,
    tags: deserializeTags(row.tags),
    stars: Number(row.stars) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    starred,
  };
}

export function toDetail(row: SkillRow, starred = false): SkillDetail & { starred: boolean } {
  return { ...toSummary(row, starred), markdown: row.markdown };
}

/** Query di ricerca ripulita: stringa vuota significa "nessun filtro". */
export function normalizeQuery(q: string | null | undefined): string {
  return (q ?? '').trim().slice(0, 80);
}

/**
 * Adds the search clauses to a SQL query.
 * The terms are bound as parameters: no string interpolation.
 */
export function searchClause(query: string): { sql: string; params: string[] } {
  if (!query) return { sql: '', params: [] };
  const like = `%${query.toLowerCase()}%`;
  return {
    sql: ' AND (lower(name) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ? OR lower(owner) LIKE ?)',
    params: [like, like, like, like],
  };
}

/**
 * ORDER BY clause for the sort modes.
 *
 * `trending` is the only one that is not a plain column: it weighs stars by how
 * recently they were cast (see `TRENDING`). `pow` and the `stars` subquery are
 * supported by D1's SQLite build.
 */
export function orderClause(sort: SortKey): string {
  if (sort === 'trending') {
    const { BASE, VELOCITY_WEIGHT, GRAVITY, RECENT_WINDOW_DAYS } = TRENDING;
    const recentStars =
      `(SELECT COUNT(*) FROM stars WHERE stars.skill_id = skills.id ` +
      `AND stars.created_at >= datetime('now', '-${RECENT_WINDOW_DAYS} days'))`;
    const ageHours = `(julianday('now') - julianday(skills.created_at)) * 24`;
    const score = `((${BASE} + skills.stars + ${VELOCITY_WEIGHT} * ${recentStars}) / pow(${ageHours} + 2.0, ${GRAVITY}))`;
    return `${score} DESC, skills.stars DESC, skills.created_at DESC`;
  }
  switch (sort) {
    case 'stars':
      return 'stars DESC, created_at DESC';
    case 'name':
      return 'name COLLATE NOCASE ASC';
    default:
      return 'created_at DESC';
  }
}

/** Converts the `sort` query parameter into a known key. */
export function parseSort(value: string | null | undefined): SortKey {
  return value === 'trending' || value === 'stars' || value === 'name' ? value : 'recent';
}
