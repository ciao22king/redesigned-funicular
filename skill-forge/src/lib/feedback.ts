/**
 * Feedback on a generation: "was this useful, and what is missing?".
 *
 * It is asked right after the skill appears, when the person still remembers
 * what they expected, and it is two fields: a verdict and an optional note.
 * Anything longer goes unanswered.
 *
 * The verdict is a closed set so the numbers mean something; the note is
 * sanitised and capped like every other free text that reaches storage.
 */

import { sanitizePublicText } from './sanitize';

/** How useful the generated skill was. Closed set, shown in this order. */
export const FEEDBACK_VERDICTS = ['yes', 'partly', 'no'] as const;
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];

export const VERDICT_LABELS: Record<FeedbackVerdict, string> = {
  yes: 'Yes, it was useful',
  partly: 'Partly',
  no: 'No, it missed the point',
};

export interface FeedbackInput {
  verdict?: string;
  note?: string;
  /** Which mode produced the skill, so the two can be compared. */
  mode?: string;
}

export interface NormalizedFeedback {
  verdict: FeedbackVerdict;
  note: string;
  mode: string;
}

export interface FeedbackValidation {
  ok: boolean;
  error?: string;
  value?: NormalizedFeedback;
}

/** Longest note we keep. */
export const MAX_FEEDBACK_CHARS = 500;

const MODES = ['from-skills', 'from-scratch', 'demo'] as const;

export function isFeedbackVerdict(value: string): value is FeedbackVerdict {
  return (FEEDBACK_VERDICTS as readonly string[]).includes(value);
}

/** Validates a feedback submission. */
export function validateFeedback(input: FeedbackInput): FeedbackValidation {
  const verdict = (input.verdict ?? '').trim();
  if (!isFeedbackVerdict(verdict)) {
    return { ok: false, error: 'Choose one of the three answers.' };
  }

  const mode = (MODES as readonly string[]).includes(input.mode ?? '')
    ? (input.mode as string)
    : 'from-skills';

  return {
    ok: true,
    value: {
      verdict,
      note: sanitizePublicText(input.note ?? '').slice(0, MAX_FEEDBACK_CHARS),
      mode,
    },
  };
}

export interface FeedbackRow {
  id: number;
  verdict: string;
  note: string;
  mode: string;
  created_at: string;
}

export interface FeedbackSummary {
  total: number;
  yes: number;
  partly: number;
  no: number;
  /** Share of answers that were at least partly useful. */
  usefulShare: number;
}

/** Aggregates the verdicts into the three counters and a useful share. */
export function summarizeFeedback(rows: { verdict: string }[]): FeedbackSummary {
  const total = rows.length;
  const count = (v: FeedbackVerdict) => rows.filter((r) => r.verdict === v).length;
  const yes = count('yes');
  const partly = count('partly');
  const no = count('no');
  return {
    total,
    yes,
    partly,
    no,
    usefulShare: total > 0 ? (yes + partly) / total : 0,
  };
}
