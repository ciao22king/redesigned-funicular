/**
 * Public skill pages: the pure part.
 *
 * Everything that can be decided without touching D1 lives here — the category
 * taxonomy, the URL shapes, the related-skills ranking and the version notes —
 * so the page, the sitemap and the CLI cannot disagree about what a skill page
 * is, and so all of it is testable without a database.
 *
 * A skill's public id is `owner/slug` (see `marketplace.ts`): the slug alone is
 * not unique, because two authors may publish a skill with the same name. The
 * canonical URL therefore carries both segments, and the one-segment form
 * (`/skills/<slug>`) is a convenience that resolves when — and only when — the
 * slug is unambiguous.
 */

/** Canonical path of a skill page. */
export function skillPath(owner: string, slug: string): string {
  return `/skills/${owner}/${slug}`;
}

/** Short form: resolved by the route, redirected to the canonical path. */
export function skillSlugPath(slug: string): string {
  return `/skills/${slug}`;
}

/** The old address, kept so shared links keep working. */
export function legacySkillPath(id: string): string {
  return `/s/${id}`;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * The closed taxonomy a skill is filed under.
 *
 * It is deliberately small: a category is a browsing aid, not a claim about the
 * work. The value is computed once at publish time from the tags and the text
 * (see `categoryFor`) and stored, so the category listing is one indexed query.
 */
export const CATEGORIES = [
  'code',
  'ops',
  'docs',
  'data',
  'product',
  'support',
  'design',
  'other',
] as const;

export type CategoryId = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  description: string;
  /** Words that, found in the tags or the text, point to this category. */
  keywords: string[];
}

export const CATEGORY_META: CategoryMeta[] = [
  {
    id: 'code',
    label: 'Code & engineering',
    description: 'Reviewing, writing, testing and shipping code.',
    keywords: [
      'code', 'review', 'git', 'refactor', 'refactoring', 'test', 'tests', 'testing',
      'bug', 'debug', 'debugging', 'api', 'security', 'performance', 'typescript',
      'javascript', 'python', 'rust', 'sql', 'migration', 'regex',
    ],
  },
  {
    id: 'ops',
    label: 'Operations & reliability',
    description: 'Deploying, monitoring and running systems in production.',
    keywords: [
      'devops', 'deploy', 'deployment', 'incident', 'postmortem', 'monitoring',
      'oncall', 'on-call', 'kubernetes', 'docker', 'ci', 'cd', 'infrastructure',
      'runbook', 'reliability', 'sre', 'observability', 'alerting',
    ],
  },
  {
    id: 'docs',
    label: 'Writing & documentation',
    description: 'Explaining, documenting and publishing clearly.',
    keywords: [
      'documentation', 'docs', 'writing', 'content', 'readme', 'technical-writing',
      'blog', 'seo', 'editorial', 'copywriting', 'proofreading',
    ],
  },
  {
    id: 'data',
    label: 'Data & analytics',
    description: 'Measuring, analysing and reporting on data.',
    keywords: [
      'data', 'analytics', 'metrics', 'etl', 'dataset', 'reporting', 'dashboard',
      'statistics', 'visualization', 'visualisation', 'pipeline',
    ],
  },
  {
    id: 'product',
    label: 'Product & planning',
    description: 'Deciding what to build and why, before building it.',
    keywords: [
      'product', 'prd', 'planning', 'roadmap', 'requirements', 'spec',
      'prioritization', 'prioritisation', 'strategy', 'discovery',
    ],
  },
  {
    id: 'support',
    label: 'Support & customers',
    description: 'Answering, onboarding and helping people.',
    keywords: [
      'support', 'customer', 'ticket', 'crm', 'faq', 'onboarding', 'helpdesk',
      'customer-success', 'churn',
    ],
  },
  {
    id: 'design',
    label: 'Design & experience',
    description: 'Shaping how a product looks, reads and feels.',
    keywords: [
      'design', 'ux', 'ui', 'accessibility', 'a11y', 'figma', 'brand',
      'usability', 'interaction',
    ],
  },
  {
    id: 'other',
    label: 'Everything else',
    description: 'Skills that do not fit the categories above.',
    keywords: [],
  },
];

const CATEGORY_BY_ID = new Map(CATEGORY_META.map((c) => [c.id, c]));

export function isCategory(value: string): value is CategoryId {
  return CATEGORY_BY_ID.has(value as CategoryId);
}

export function categoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORY_BY_ID.get(id) ?? CATEGORY_BY_ID.get('other')!;
}

export function categoryLabel(id: CategoryId): string {
  return categoryMeta(id).label;
}

export interface CategoryInput {
  tags?: string[];
  name?: string;
  description?: string;
  markdown?: string;
}

/**
 * Files a skill under one category.
 *
 * The tags are the strongest signal — they are chosen on purpose — so if any tag
 * names a category, that decides it and the text is not consulted at all. Only
 * when no tag matches does the text choose. Ties are broken by the order of
 * `CATEGORIES`, so the same skill always lands in the same place.
 */
export function categoryFor(input: CategoryInput): CategoryId {
  const tags = (input.tags ?? []).map((t) => t.toLowerCase());
  const text = `${input.name ?? ''} ${input.description ?? ''} ${input.markdown ?? ''}`
    .toLowerCase();

  const tagBest = bestCategory((meta) =>
    meta.keywords.reduce((n, keyword) => n + (tags.includes(keyword) ? 1 : 0), 0),
  );
  if (tagBest) return tagBest;

  return bestCategory((meta) =>
    meta.keywords.reduce((n, keyword) => n + (containsWord(text, keyword) ? 1 : 0), 0),
  ) ?? 'other';
}

/** The category with the highest score, or null when every score is zero. */
function bestCategory(score: (meta: CategoryMeta) => number): CategoryId | null {
  let best: CategoryId | null = null;
  let bestScore = 0;
  for (const meta of CATEGORY_META) {
    if (meta.id === 'other') continue;
    const value = score(meta);
    if (value > bestScore) {
      bestScore = value;
      best = meta.id;
    }
  }
  return best;
}

/** Word-boundary match, so `api` does not fire inside `capital`. */
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

// ---------------------------------------------------------------------------
// Related skills
// ---------------------------------------------------------------------------

export interface RelatedCandidate {
  id: string;
  tags?: string[];
  category?: string;
  stars?: number;
}

/**
 * Ranks the other skills by how close they are to the one being read.
 *
 * Relevance is decided first: a shared tag is the strongest signal (someone
 * reading a `git` skill wants the other `git` skills), the same category is a
 * weaker one, and a skill with neither is not related at all — popularity alone
 * never puts a skill in the list. Stars only break ties between equally relevant
 * skills, so the most useful sibling comes first. The current skill is never
 * included, and the result is bounded.
 */
export function pickRelated<T extends RelatedCandidate>(
  candidates: T[],
  current: { id: string; tags?: string[]; category?: string },
  limit = 4,
): T[] {
  const currentTags = new Set((current.tags ?? []).map((t) => t.toLowerCase()));

  const scored = candidates
    .filter((c) => c.id !== current.id)
    .map((c) => {
      const tags = (c.tags ?? []).map((t) => t.toLowerCase());
      const shared = tags.filter((t) => currentTags.has(t)).length;
      const sameCategory = current.category && c.category === current.category ? 1 : 0;
      const relevance = shared * 10 + sameCategory * 3;
      const stars = Number(c.stars) || 0;
      return { c, relevance, stars };
    })
    .filter((entry) => entry.relevance > 0)
    .sort(
      (a, b) =>
        b.relevance - a.relevance || b.stars - a.stars || a.c.id.localeCompare(b.c.id),
    )
    .slice(0, Math.max(0, limit));

  return scored.map((entry) => entry.c);
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

/** The version number that comes after the highest one recorded so far. */
export function nextVersion(highest: number): number {
  const base = Number.isFinite(highest) && highest > 0 ? Math.floor(highest) : 0;
  return base + 1;
}

export interface VersionSnapshot {
  name: string;
  description: string;
  tags: string;
  markdown: string;
}

/**
 * Stable, synchronous hash of a skill's content.
 *
 * FNV-1a over the fields that make a version distinct. It is not a security
 * hash and does not need to be: it only has to answer "is this the same content
 * as the last version?", and it must be cheap and synchronous on the Worker.
 */
export function contentHash(snapshot: VersionSnapshot): string {
  const input = `${snapshot.name}\u0000${snapshot.description}\u0000${snapshot.tags}\u0000${snapshot.markdown}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Labels of the fields that differ between two snapshots, in reading order. */
export function changedFields(previous: VersionSnapshot, next: VersionSnapshot): string[] {
  const changed: string[] = [];
  if (previous.name !== next.name) changed.push('the name');
  if (previous.description !== next.description) changed.push('the description');
  if (previous.tags !== next.tags) changed.push('the tags');
  if (previous.markdown !== next.markdown) changed.push('the body');
  return changed;
}

/**
 * The one-line note stored with a version.
 *
 * A changelog is only worth reading if it says what changed, so the note names
 * the fields rather than saying "updated": the person who published it does not
 * have to write anything, and the reader still learns something.
 */
export function versionNote(version: number, changed: string[]): string {
  if (version <= 1) return 'First published version.';
  if (changed.length === 0) return 'Republished without changes.';
  const list = joinList(changed);
  return `Updated ${list}.`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export interface VersionEntry {
  version: number;
  note: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * The breadcrumb trail for a skill page: Home > Skills > Category > Name. The
 * last crumb has no link, because it is the page itself.
 */
export function skillBreadcrumb(input: {
  skillName: string;
  category: CategoryId;
}): Crumb[] {
  return [
    { label: 'Home', href: '/' },
    { label: 'Skills', href: '/skills' },
    { label: categoryLabel(input.category), href: `/skills/category/${input.category}` },
    { label: input.skillName },
  ];
}
