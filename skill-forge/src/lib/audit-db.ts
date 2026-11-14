import { getDatabase, type D1Like } from './d1';
import { isAuditAction, toAuditValues, type AuditEvent, type AuditRow } from './audit';

/**
 * D1 access for the audit log.
 *
 * Writing an audit line must never break the action it describes: a publish
 * that succeeded but whose log line failed is still a success. `recordAudit`
 * therefore swallows its own errors and returns a boolean, and every caller
 * ignores the result.
 */

/** Appends one event. Best effort: never throws. */
export async function recordAudit(
  event: AuditEvent,
  injected?: D1Like,
): Promise<boolean> {
  if (!isAuditAction(event.action)) return false;
  try {
    const database = await getDatabase(injected);
    const v = toAuditValues(event);
    await database
      .prepare(
        `INSERT INTO audit_log (at, actor, action, target, detail, ip)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(v.at, v.actor, v.action, v.target, v.detail, v.ip)
      .run();
    return true;
  } catch {
    return false;
  }
}

/** Most recent events first, bounded. For the owner to inspect. */
export async function listAudit(
  limit = 100,
  injected?: D1Like,
): Promise<AuditRow[]> {
  const database = await getDatabase(injected);
  const result = await database
    .prepare('SELECT id, at, actor, action, target, detail, ip FROM audit_log ORDER BY id DESC LIMIT ?')
    .bind(Math.min(Math.max(limit, 1), 1000))
    .all<AuditRow>();
  return result.results ?? [];
}

/**
 * Deletes audit lines older than the retention window, so the table does not
 * grow forever. Returns how many were removed.
 */
export async function pruneAudit(
  retentionDays = 180,
  injected?: D1Like,
): Promise<number> {
  const database = await getDatabase(injected);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const result = (await database
    .prepare('DELETE FROM audit_log WHERE at < ?')
    .bind(cutoff)
    .run()) as { meta?: { changes?: number } } | undefined;
  return Number(result?.meta?.changes ?? 0);
}
