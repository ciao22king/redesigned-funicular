/**
 * Admin panel: the pure rules.
 *
 * Everything that can be decided without a database lives here — who may enter,
 * what a skill's moderation status may become, how a creator's standing is
 * derived from the flags, and how a CSV is written — so the guards, the pages
 * and the exports all read from one place and can be tested on their own.
 *
 * The panel is single-operator by design: access is a closed list of logins,
 * not a permission system. A closed list is one thing to get right instead of
 * many, and the operator is the person who runs the service.
 */

/** Skills moderation statuses. Only `published` is visible to the public. */
export const SKILL_STATUSES = ['published', 'pending', 'rejected', 'removed'] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

/** The status a freshly published skill gets: publishing stays immediate. */
export const DEFAULT_SKILL_STATUS: SkillStatus = 'published';

export function isSkillStatus(value: unknown): value is SkillStatus {
  return typeof value === 'string' && (SKILL_STATUSES as readonly string[]).includes(value);
}

/** True when a skill with this status may be read by anyone. */
export function isPublicSkillStatus(status: unknown): boolean {
  return status === 'published';
}

const SKILL_STATUS_LABELS: Record<SkillStatus, string> = {
  published: 'Published',
  pending: 'Pending review',
  rejected: 'Rejected',
  removed: 'Removed',
};

export function skillStatusLabel(status: string): string {
  return isSkillStatus(status) ? SKILL_STATUS_LABELS[status] : status;
}

/** What an operator may do to a skill, so the UI and the route agree. */
export const SKILL_STATUS_ACTIONS: { status: SkillStatus; label: string }[] = [
  { status: 'published', label: 'Approve' },
  { status: 'pending', label: 'Send to review' },
  { status: 'rejected', label: 'Reject' },
  { status: 'removed', label: 'Remove' },
];

/** Creators' standing. `suspended` hides from discovery; `banned` is the sanction. */
export const CREATOR_STATUSES = ['active', 'suspended', 'banned'] as const;
export type CreatorStatus = (typeof CREATOR_STATUSES)[number];

export function isCreatorStatus(value: unknown): value is CreatorStatus {
  return typeof value === 'string' && (CREATOR_STATUSES as readonly string[]).includes(value);
}

/** Derives a creator's standing from the two stored flags. Ban wins over suspend. */
export function creatorStatus(profile: { banned: boolean; suspended: boolean }): CreatorStatus {
  if (profile.banned) return 'banned';
  if (profile.suspended) return 'suspended';
  return 'active';
}

const CREATOR_STATUS_LABELS: Record<CreatorStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  banned: 'Banned',
};

export function creatorStatusLabel(status: string): string {
  return isCreatorStatus(status) ? CREATOR_STATUS_LABELS[status] : status;
}

/**
 * The logins allowed into `/admin`.
 *
 * A closed list read from configuration, defaulting to the service owner. The
 * check is by login, never by role: a founding tester is trusted with a badge,
 * not with the moderation tools.
 */
export function adminLogins(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env.ADMIN_LOGINS ?? env.UNLIMITED_LOGINS ?? 'ciao22king';
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the login may open the admin panel. */
export function isAdmin(
  login: string | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!login) return false;
  return adminLogins(env).includes(login.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/**
 * Escapes one CSV cell.
 *
 * The rules are the RFC 4180 ones, because the file is opened in a spreadsheet:
 * a value is quoted when it holds a comma, a quote or a newline, and an inner
 * quote is doubled. A leading `=`, `+`, `-` or `@` is also prefixed with a
 * quote, which stops a crafted display name from being read as a formula.
 */
export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const risky = /^[=+\-@]/.test(text);
  const mustQuote = risky || /[",\r\n]/.test(text);
  if (!mustQuote) return text;
  const body = risky ? `'${text}` : text;
  return `"${body.replace(/"/g, '""')}"`;
}

/** Serialises a table to CSV, with a header row. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  // A trailing newline so the file ends on a line boundary.
  return `${lines.join('\r\n')}\r\n`;
}

export const CREATORS_CSV_HEADERS = [
  'login',
  'display_name',
  'status',
  'verified',
  'verified_socials',
  'badges',
  'published',
  'stars',
  'downloads',
  'first_seen',
  'last_seen',
];

export const SKILLS_CSV_HEADERS = [
  'id',
  'owner',
  'name',
  'status',
  'category',
  'tags',
  'stars',
  'downloads',
  'created_at',
  'updated_at',
];
