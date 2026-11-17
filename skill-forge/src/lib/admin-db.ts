import { getDatabase, type D1Like } from './d1';

/**
 * D1 access for the admin panel.
 *
 * Reads only, plus the counters the dashboard needs. Every query is bounded and
 * grouped, so a dashboard load is a handful of round trips and not one per row.
 * Same conventions as the other `*-db` modules: injectable database, and a
 * missing binding surfaces as an empty result rather than a crash.
 */

export interface AdminCounts {
  users: number;
  skills: number;
  skillsByStatus: Record<string, number>;
  downloads: number;
  generations: number;
  openReports: number;
  openProfileReports: number;
  creators: number;
  banned: number;
  suspended: number;
}

/** The dashboard totals, in one batch of aggregate queries. */
export async function adminCounts(injected?: D1Like): Promise<AdminCounts> {
  const database = await getDatabase(injected);

  const results = (await database.batch([
    database.prepare('SELECT COUNT(*) AS n FROM users'),
    database.prepare('SELECT COUNT(*) AS n FROM skills'),
    database.prepare('SELECT status, COUNT(*) AS n FROM skills GROUP BY status'),
    database.prepare("SELECT COALESCE(SUM(count), 0) AS n FROM metrics WHERE event = 'download'"),
    database.prepare("SELECT COALESCE(SUM(count), 0) AS n FROM metrics WHERE event IN ('generate', 'demo_generate')"),
    database.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    database.prepare("SELECT COUNT(*) AS n FROM profile_reports WHERE status = 'open'"),
    database.prepare('SELECT COUNT(DISTINCT owner) AS n FROM skills'),
    database.prepare('SELECT COUNT(*) AS n FROM profiles WHERE banned = 1'),
    database.prepare('SELECT COUNT(*) AS n FROM profiles WHERE suspended = 1'),
  ])) as unknown[];

  const [users, skills, byStatus, downloads, generations, reports, profileReports, creators, banned, suspended] =
    results;

  const first = <T>(result: unknown): T | undefined =>
    (result as { results?: T[] } | undefined)?.results?.[0];

  const statusRows = (byStatus as { results?: { status: string; n: number }[] } | undefined)?.results ?? [];
  const skillsByStatus: Record<string, number> = {};
  for (const row of statusRows) skillsByStatus[row.status] = Number(row.n) || 0;

  return {
    users: Number(first<{ n: number }>(users)?.n ?? 0),
    skills: Number(first<{ n: number }>(skills)?.n ?? 0),
    skillsByStatus,
    downloads: Number(first<{ n: number }>(downloads)?.n ?? 0),
    generations: Number(first<{ n: number }>(generations)?.n ?? 0),
    openReports: Number(first<{ n: number }>(reports)?.n ?? 0),
    openProfileReports: Number(first<{ n: number }>(profileReports)?.n ?? 0),
    creators: Number(first<{ n: number }>(creators)?.n ?? 0),
    banned: Number(first<{ n: number }>(banned)?.n ?? 0),
    suspended: Number(first<{ n: number }>(suspended)?.n ?? 0),
  };
}

export interface AdminCreatorRow {
  login: string;
  displayName: string;
  avatarUrl: string;
  verified: boolean;
  suspended: boolean;
  banned: boolean;
  published: number;
  stars: number;
  downloads: number;
  manualBadges: string[];
  lastSeen: string;
}

export interface AdminCreatorFilters {
  query?: string;
  status?: string;
  verified?: boolean;
  limit?: number;
}

/**
 * The creators list for the admin panel, with search and filters.
 *
 * The base is the set of logins that either signed in (`users`) or published a
 * skill, so an account that never published still appears and can be moderated.
 * Totals come from grouped subqueries, and the whole thing is one query.
 */
export async function adminCreators(
  filters: AdminCreatorFilters = {},
  injected?: D1Like,
): Promise<AdminCreatorRow[]> {
  const database = await getDatabase(injected);
  const conditions: string[] = [];
  const params: unknown[] = [];

  const query = (filters.query ?? '').trim().toLowerCase();
  if (query) {
    conditions.push('(lower(u.login) LIKE ? OR lower(COALESCE(p.display_name, \'\')) LIKE ?)');
    params.push(`%${query}%`, `%${query}%`);
  }
  if (filters.status === 'active') conditions.push('COALESCE(p.suspended, 0) = 0 AND COALESCE(p.banned, 0) = 0');
  if (filters.status === 'suspended') conditions.push('COALESCE(p.suspended, 0) = 1 AND COALESCE(p.banned, 0) = 0');
  if (filters.status === 'banned') conditions.push('COALESCE(p.banned, 0) = 1');
  if (filters.verified) conditions.push('COALESCE(p.verified, 0) = 1');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 1000);

  const result = await database
    .prepare(
      `SELECT u.login AS login,
              COALESCE(p.display_name, '') AS display_name,
              COALESCE(p.avatar_url, '') AS avatar_url,
              COALESCE(p.verified, 0) AS verified,
              COALESCE(p.suspended, 0) AS suspended,
              COALESCE(p.banned, 0) AS banned,
              COALESCE(s.published, 0) AS published,
              COALESCE(s.stars, 0) AS stars,
              COALESCE(s.downloads, 0) AS downloads,
              COALESCE(u.last_seen, '') AS last_seen
       FROM (SELECT login, MAX(last_seen) AS last_seen FROM users GROUP BY login
             UNION
             SELECT owner AS login, MAX(updated_at) AS last_seen FROM skills GROUP BY owner) u
       LEFT JOIN profiles p ON p.login = u.login
       LEFT JOIN (
         SELECT sk.owner AS owner,
                SUM(CASE WHEN sk.status = 'published' THEN 1 ELSE 0 END) AS published,
                COALESCE(SUM(CASE WHEN sk.status = 'published' THEN sk.stars ELSE 0 END), 0) AS stars,
                COALESCE((SELECT SUM(m.count) FROM metrics m WHERE m.event = 'download'
                          AND m.target IN (SELECT id FROM skills WHERE owner = sk.owner AND status = 'published')), 0) AS downloads
         FROM skills sk GROUP BY sk.owner
       ) s ON s.owner = u.login
       ${where}
       ORDER BY s.stars DESC, u.login ASC
       LIMIT ?`,
    )
    .bind(...params, limit)
    .all<{
      login: string;
      display_name: string;
      avatar_url: string;
      verified: number;
      suspended: number;
      banned: number;
      published: number;
      stars: number;
      downloads: number;
      last_seen: string;
    }>();

  return (result.results ?? []).map((row) => ({
    login: row.login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    verified: Number(row.verified) === 1,
    suspended: Number(row.suspended) === 1,
    banned: Number(row.banned) === 1,
    published: Number(row.published) || 0,
    stars: Number(row.stars) || 0,
    downloads: Number(row.downloads) || 0,
    manualBadges: [],
    lastSeen: row.last_seen,
  }));
}

export interface AdminSkillRow {
  id: string;
  owner: string;
  name: string;
  description: string;
  status: string;
  category: string;
  tags: string;
  stars: number;
  downloads: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSkillFilters {
  query?: string;
  status?: string;
  owner?: string;
  limit?: number;
}

/** The skills list for the admin panel: every status, with search and filters. */
export async function adminSkills(
  filters: AdminSkillFilters = {},
  injected?: D1Like,
): Promise<AdminSkillRow[]> {
  const database = await getDatabase(injected);
  const conditions: string[] = [];
  const params: unknown[] = [];

  const query = (filters.query ?? '').trim().toLowerCase();
  if (query) {
    conditions.push('(lower(name) LIKE ? OR lower(id) LIKE ? OR lower(owner) LIKE ?)');
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.owner) {
    conditions.push('owner = ?');
    params.push(filters.owner);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 1000);

  const result = await database
    .prepare(
      `SELECT s.id, s.owner, s.name, s.description, s.status, s.category, s.tags, s.stars, s.created_at, s.updated_at,
              COALESCE((SELECT SUM(m.count) FROM metrics m WHERE m.event = 'download' AND m.target = s.id), 0) AS downloads
       FROM skills s ${where}
       ORDER BY s.updated_at DESC
       LIMIT ?`,
    )
    .bind(...params, limit)
    .all<{
      id: string;
      owner: string;
      name: string;
      description: string;
      status: string;
      category: string;
      tags: string;
      stars: number;
      created_at: string;
      updated_at: string;
      downloads: number;
    }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    owner: row.owner,
    name: row.name,
    description: row.description,
    status: row.status,
    category: row.category,
    tags: row.tags,
    stars: Number(row.stars) || 0,
    downloads: Number(row.downloads) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export interface AdminReportRow {
  id: number;
  kind: 'skill' | 'profile';
  target: string;
  reason: string;
  note: string;
  reporter: string;
  status: string;
  createdAt: string;
}

/** The report queue: open skill and profile reports, newest first. */
export async function adminReports(
  status = 'open',
  limit = 200,
  injected?: D1Like,
): Promise<AdminReportRow[]> {
  const database = await getDatabase(injected);
  const bounded = Math.min(Math.max(limit, 1), 1000);
  const filter = status === 'all' ? '' : 'WHERE status = ?';

  const [skills, profiles] = await Promise.all([
    database
      .prepare(
        `SELECT id, skill_id AS target, reason, note, reporter, status, created_at FROM reports ${filter} ORDER BY id DESC LIMIT ?`,
      )
      .bind(...(status === 'all' ? [] : [status]), bounded)
      .all<{ id: number; target: string; reason: string; note: string; reporter: string; status: string; created_at: string }>(),
    database
      .prepare(
        `SELECT id, username AS target, reason, note, reporter, status, created_at FROM profile_reports ${filter} ORDER BY id DESC LIMIT ?`,
      )
      .bind(...(status === 'all' ? [] : [status]), bounded)
      .all<{ id: number; target: string; reason: string; note: string; reporter: string; status: string; created_at: string }>(),
  ]);

  const rows: AdminReportRow[] = [
    ...(skills.results ?? []).map((r) => ({
      id: r.id,
      kind: 'skill' as const,
      target: r.target,
      reason: r.reason,
      note: r.note,
      reporter: r.reporter,
      status: r.status,
      createdAt: r.created_at,
    })),
    ...(profiles.results ?? []).map((r) => ({
      id: r.id,
      kind: 'profile' as const,
      target: r.target,
      reason: r.reason,
      note: r.note,
      reporter: r.reporter,
      status: r.status,
      createdAt: r.created_at,
    })),
  ];

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, bounded);
}

/** Sets the status of a skill report. Returns false when it does not exist. */
export async function setReportStatus(
  id: number,
  status: string,
  injected?: D1Like,
): Promise<boolean> {
  const database = await getDatabase(injected);
  const result = (await database
    .prepare('UPDATE reports SET status = ? WHERE id = ?')
    .bind(status, id)
    .run()) as { meta?: { changes?: number } } | undefined;
  return Number(result?.meta?.changes ?? 0) > 0;
}

/** Sets the status of a profile report. Returns false when it does not exist. */
export async function setProfileReportStatus(
  id: number,
  status: string,
  injected?: D1Like,
): Promise<boolean> {
  const database = await getDatabase(injected);
  const result = (await database
    .prepare('UPDATE profile_reports SET status = ? WHERE id = ?')
    .bind(status, id)
    .run()) as { meta?: { changes?: number } } | undefined;
  return Number(result?.meta?.changes ?? 0) > 0;
}
