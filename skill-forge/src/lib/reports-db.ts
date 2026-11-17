import { getDatabase, type D1Like } from './d1';
import type { NormalizedReport, ReportRow } from './reports';

/**
 * D1 access for reports.
 *
 * A report is inserted once and never edited. The unique key on
 * `(skill_id, reporter_key, day)` stops the same reporter from filling the
 * table with duplicates for one skill on the same day, while still letting a
 * different person report the same skill.
 */

export interface CreateReportInput {
  report: NormalizedReport;
  /** GitHub login when signed in, otherwise a stable key derived from the IP. */
  reporter: string;
  ip: string;
}

/** Inserts a report. Returns the new id, or null when it was a duplicate. */
export async function createReport(
  input: CreateReportInput,
  injected?: D1Like,
): Promise<number | null> {
  const database = await getDatabase(injected);
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const reporterKey = input.reporter || 'anonymous';

  try {
    const result = (await database
      .prepare(
        `INSERT OR IGNORE INTO reports (skill_id, reason, note, reporter, reporter_key, ip, day, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .bind(
        input.report.skillId,
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

/** Open reports, newest first. For the owner to triage. */
export async function listOpenReports(
  limit = 100,
  injected?: D1Like,
): Promise<ReportRow[]> {
  const database = await getDatabase(injected);
  const result = await database
    .prepare(
      "SELECT id, skill_id, reason, note, reporter, ip, status, created_at FROM reports WHERE status = 'open' ORDER BY id DESC LIMIT ?",
    )
    .bind(Math.min(Math.max(limit, 1), 1000))
    .all<ReportRow>();
  return result.results ?? [];
}

/** How many reports a skill has, for a small badge. */
export async function countReports(skillId: string, injected?: D1Like): Promise<number> {
  const database = await getDatabase(injected);
  const row = await database
    .prepare('SELECT COUNT(*) AS n FROM reports WHERE skill_id = ?')
    .bind(skillId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}
