/**
 * Minimal audit log: who did what, to which target, and when.
 *
 * The log is deliberately small. It records the events that change the public
 * state of the service (publish, delete, report, star) with the actor and the
 * target, and nothing about the content of the material: an audit trail is for
 * accountability, not for surveillance, and keeping the payloads out is both
 * safer and consistent with the privacy policy.
 *
 * The types and the row builder are pure, so the shape of a record is testable
 * without a database.
 */

/** Actions worth a permanent line. Kept as a closed set so the column stays clean. */
export const AUDIT_ACTIONS = [
  'publish',
  'unpublish',
  'report',
  'star',
  'unstar',
  'profile.update',
  'profile.report',
  // Operator area. One action per kind of change, so the trail says what was
  // done and not only that "something" was done.
  'admin.login',
  'admin.creator.verify',
  'admin.creator.social',
  'admin.creator.badge',
  'admin.creator.status',
  'admin.skill.status',
  'admin.report.status',
  'admin.export',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEvent {
  /** GitHub login of the person, or `anonymous` for the public endpoints. */
  actor: string;
  action: AuditAction;
  /** What the action was about: a skill id, a report id. */
  target: string;
  /** Optional short note. Never the material itself. */
  detail?: string;
  /** Client address, for abuse investigation. */
  ip?: string;
  /** When it happened, ISO. Injected so the builder is deterministic in tests. */
  at?: string;
}

export interface AuditRow {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
}

/** Shortest detail we keep: enough to tell two events apart, never the content. */
export const MAX_DETAIL_CHARS = 200;

/**
 * Normalises an event into the values written to D1.
 *
 * Every field is bounded, so a crafted target or detail cannot bloat the table.
 */
export function toAuditValues(event: AuditEvent): {
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
} {
  return {
    at: event.at ?? new Date().toISOString(),
    actor: (event.actor || 'anonymous').slice(0, 60),
    action: event.action,
    target: event.target.slice(0, 300),
    detail: (event.detail ?? '').slice(0, MAX_DETAIL_CHARS),
    ip: (event.ip ?? '').slice(0, 60),
  };
}

/** Human-readable one-liner, for a future admin view or a log line. */
export function describeEvent(event: AuditEvent): string {
  return `${event.actor} ${event.action} ${event.target}`;
}

/** True when the action is one we accept, used to reject junk before the insert. */
export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
