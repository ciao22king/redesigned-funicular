import { getDatabase, type D1Like } from './d1';
import { isLogin } from './users';
import {
  emptyProfile,
  parseVerifiedSocials,
  type CreatorProfile,
  type NormalizedProfile,
  type NormalizedProfileReport,
} from './profile';

/**
 * D1 access for the public profiles.
 *
 * Same conventions as the other `*-db` modules: the database is injectable (so
 * the tests pass a fake) and a missing binding degrades to the defaults instead
 * of crashing the render.
 */

interface ProfileRow {
  login: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  x: string;
  linkedin: string;
  youtube: string;
  website: string;
  newsletter: string;
  verified: number;
  suspended: number;
  banned: number;
  verified_socials: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): CreatorProfile {
  return {
    login: row.login,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    x: row.x,
    linkedin: row.linkedin,
    youtube: row.youtube,
    website: row.website,
    newsletter: row.newsletter,
    verified: Number(row.verified) === 1,
    suspended: Number(row.suspended) === 1,
    banned: Number(row.banned) === 1,
    verifiedSocials: parseVerifiedSocials(row.verified_socials),
    hasRow: true,
    updatedAt: row.updated_at,
  };
}

const COLUMNS =
  'login, display_name, bio, avatar_url, x, linkedin, youtube, website, newsletter, verified, suspended, banned, verified_socials, updated_at';

/**
 * A profile, or the defaults when the row does not exist yet.
 *
 * It never throws: an invalid login or a missing binding returns the empty
 * profile, so a public page always has something to render.
 */
export async function getProfile(
  login: string,
  injected?: D1Like,
): Promise<CreatorProfile> {
  if (!isLogin(login)) return emptyProfile(login);
  try {
    const database = await getDatabase(injected);
    const row = await database
      .prepare(`SELECT ${COLUMNS} FROM profiles WHERE login = ?`)
      .bind(login)
      .first<ProfileRow>();
    return row ? toProfile(row) : emptyProfile(login);
  } catch {
    return emptyProfile(login);
  }
}

/** Saves the editable part of a profile, creating the row on first save. */
export async function saveProfile(
  login: string,
  profile: NormalizedProfile,
  injected?: D1Like,
  now = new Date().toISOString(),
): Promise<CreatorProfile> {
  if (!isLogin(login)) return emptyProfile(login);
  const database = await getDatabase(injected);
  const { socials } = profile;
  await database
    .prepare(
      `INSERT INTO profiles (login, display_name, bio, avatar_url, x, linkedin, youtube, website, newsletter, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(login) DO UPDATE SET
         display_name = excluded.display_name,
         bio          = excluded.bio,
         avatar_url   = excluded.avatar_url,
         x            = excluded.x,
         linkedin     = excluded.linkedin,
         youtube      = excluded.youtube,
         website      = excluded.website,
         newsletter   = excluded.newsletter,
         updated_at   = excluded.updated_at`,
    )
    .bind(
      login,
      profile.displayName,
      profile.bio,
      profile.avatarUrl,
      socials.x,
      socials.linkedin,
      socials.youtube,
      socials.website,
      socials.newsletter,
      now,
    )
    .run();

  return getProfile(login, injected);
}

/**
 * Logins whose profile is hidden from discovery: suspended or banned.
 *
 * The directory and the sitemap list authors from the `skills` table; this set
 * is subtracted from them so a moderated profile disappears from discovery
 * while its own page keeps working.
 */
export async function suspendedLogins(injected?: D1Like): Promise<Set<string>> {
  try {
    const database = await getDatabase(injected);
    const result = await database
      .prepare('SELECT login FROM profiles WHERE suspended = 1 OR banned = 1')
      .all<{ login: string }>();
    return new Set((result.results ?? []).map((r) => r.login));
  } catch {
    return new Set();
  }
}

/**
 * Sets the two moderation flags on a profile.
 *
 * The row is created if it does not exist yet, because a ban must be possible
 * before the person ever edits their profile. The other fields keep their
 * defaults on first insert, and an existing row is only touched in the two
 * flag columns.
 */
export async function setProfileModeration(
  login: string,
  flags: { suspended: boolean; banned: boolean },
  injected?: D1Like,
  now = new Date().toISOString(),
): Promise<boolean> {
  if (!isLogin(login)) return false;
  try {
    const database = await getDatabase(injected);
    await database
      .prepare(
        `INSERT INTO profiles (login, suspended, banned, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(login) DO UPDATE SET
           suspended = excluded.suspended,
           banned    = excluded.banned,
           updated_at = excluded.updated_at`,
      )
      .bind(login, flags.suspended ? 1 : 0, flags.banned ? 1 : 0, now)
      .run();
    return true;
  } catch {
    return false;
  }
}

/** Sets the `verified` flag on a profile, creating the row if needed. */
export async function setProfileVerified(
  login: string,
  verified: boolean,
  injected?: D1Like,
  now = new Date().toISOString(),
): Promise<boolean> {
  if (!isLogin(login)) return false;
  try {
    const database = await getDatabase(injected);
    await database
      .prepare(
        `INSERT INTO profiles (login, verified, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(login) DO UPDATE SET
           verified   = excluded.verified,
           updated_at = excluded.updated_at`,
      )
      .bind(login, verified ? 1 : 0, now)
      .run();
    return true;
  } catch {
    return false;
  }
}

/** Stores the comma-separated list of confirmed social keys for a profile. */
export async function setVerifiedSocials(
  login: string,
  keys: string[],
  injected?: D1Like,
  now = new Date().toISOString(),
): Promise<boolean> {
  if (!isLogin(login)) return false;
  try {
    const database = await getDatabase(injected);
    await database
      .prepare(
        `INSERT INTO profiles (login, verified_socials, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(login) DO UPDATE SET
           verified_socials = excluded.verified_socials,
           updated_at       = excluded.updated_at`,
      )
      .bind(login, keys.join(','), now)
      .run();
    return true;
  } catch {
    return false;
  }
}

/**
 * Profiles for a set of logins, keyed by login.
 *
 * The directory lists many creators at once; one query returns their rows
 * instead of one per profile. Logins without a row are simply absent from the
 * map, and the caller falls back to the defaults.
 */
export async function profilesFor(
  logins: string[],
  injected?: D1Like,
): Promise<Map<string, CreatorProfile>> {
  const out = new Map<string, CreatorProfile>();
  const wanted = logins.filter(isLogin);
  if (wanted.length === 0) return out;
  try {
    const database = await getDatabase(injected);
    const placeholders = wanted.map(() => '?').join(',');
    const result = await database
      .prepare(`SELECT ${COLUMNS} FROM profiles WHERE login IN (${placeholders})`)
      .bind(...wanted)
      .all<ProfileRow>();
    for (const row of result.results ?? []) {
      out.set(row.login, toProfile(row));
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * The creators worth listing: everyone with a published skill, minus the
 * suspended ones. Ordered by name so the directory is stable between reads.
 */
export async function listIndexableCreators(
  injected?: D1Like,
): Promise<{ login: string; updatedAt: string }[]> {
  const database = await getDatabase(injected);
  const [owners, suspended] = await Promise.all([
    database
      .prepare(
        "SELECT owner AS login, MAX(updated_at) AS updated_at FROM skills WHERE status = 'published' GROUP BY owner ORDER BY owner",
      )
      .all<{ login: string; updated_at: string }>(),
    suspendedLogins(injected),
  ]);
  return (owners.results ?? [])
    .filter((row) => !suspended.has(row.login))
    .map((row) => ({ login: row.login, updatedAt: row.updated_at }));
}

/** True when the login has at least one published skill, i.e. a real creator. */
export async function hasPublishedSkills(
  login: string,
  injected?: D1Like,
): Promise<boolean> {
  if (!isLogin(login)) return false;
  try {
    const database = await getDatabase(injected);
    const row = await database
      .prepare("SELECT 1 AS ok FROM skills WHERE owner = ? AND status = 'published' LIMIT 1")
      .bind(login)
      .first<{ ok: number }>();
    return Boolean(row);
  } catch {
    return false;
  }
}

export interface CreateProfileReportInput {
  report: NormalizedProfileReport;
  reporter: string;
  ip: string;
}

/** Inserts a profile report. Returns the new id, or null on a duplicate. */
export async function createProfileReport(
  input: CreateProfileReportInput,
  injected?: D1Like,
): Promise<number | null> {
  const database = await getDatabase(injected);
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const reporterKey = input.reporter || 'anonymous';

  try {
    const result = (await database
      .prepare(
        `INSERT OR IGNORE INTO profile_reports (username, reason, note, reporter, reporter_key, ip, day, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .bind(
        input.report.username,
        input.report.reason,
        input.report.note,
        input.reporter,
        reporterKey,
        input.ip,
        day,
        now,
      )
      .run()) as { meta?: { changes?: number; last_row_id?: number } } | undefined;

    if (Number(result?.meta?.changes ?? 0) === 0) return null;
    return Number(result?.meta?.last_row_id ?? 0) || null;
  } catch {
    return null;
  }
}
