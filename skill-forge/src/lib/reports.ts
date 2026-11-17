/**
 * Reports: a visitor or a user flags a published skill.
 *
 * The reasons are a closed set, so the column stays queryable and a report can
 * be triaged. The text is sanitised and bounded, and a report never touches the
 * skill itself: it is a signal for the owner, not an automatic takedown.
 */

import { sanitizePublicText } from './sanitize';

/** Why a skill was reported. Closed set, shown in the UI in this order. */
export const REPORT_REASONS = [
  'spam',
  'malware',
  'harmful',
  'copyright',
  'misleading',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportInput {
  skillId?: string;
  reason?: string;
  note?: string;
}

export interface NormalizedReport {
  skillId: string;
  reason: ReportReason;
  note: string;
}

export interface ReportValidation {
  ok: boolean;
  error?: string;
  value?: NormalizedReport;
}

/** Longest free-text note we keep. */
export const MAX_NOTE_CHARS = 500;

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

/**
 * Validates a report from the client.
 *
 * The reason must be one of the known ones, the skill id must look like an id
 * (`owner/slug`) and the note is sanitised and capped. A report with an unknown
 * reason is rejected rather than stored, so the set stays meaningful.
 */
export function validateReport(input: ReportInput): ReportValidation {
  const skillId = (input.skillId ?? '').trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(skillId)) {
    return { ok: false, error: 'Invalid skill id.' };
  }

  const reason = (input.reason ?? '').trim();
  if (!isReportReason(reason)) {
    return { ok: false, error: 'Choose a reason for the report.' };
  }

  const note = sanitizePublicText(input.note ?? '').slice(0, MAX_NOTE_CHARS);
  return { ok: true, value: { skillId: skillId.slice(0, 300), reason, note } };
}

export interface ReportRow {
  id: number;
  skill_id: string;
  reason: string;
  note: string;
  reporter: string;
  ip: string;
  status: string;
  created_at: string;
}

/** Label shown for a reason, so the UI and the stored value cannot drift. */
export function reasonLabel(reason: ReportReason): string {
  switch (reason) {
    case 'spam':
      return 'Spam or advertising';
    case 'malware':
      return 'Malware or a harmful payload';
    case 'harmful':
      return 'Harmful or abusive content';
    case 'copyright':
      return 'Copyright infringement';
    case 'misleading':
      return 'Misleading or wrong';
    default:
      return 'Something else';
  }
}
