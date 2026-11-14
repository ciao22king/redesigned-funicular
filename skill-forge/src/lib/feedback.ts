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
  /** Optional 1 to 5 rating. Anything else, including absent, means no rating. */
  rating?: number | string;
}

export interface NormalizedFeedback {
  verdict: FeedbackVerdict;
  note: string;
  mode: string;
  /** 1 to 5, or 0 when the user did not rate. */
  rating: number;
}

export interface FeedbackValidation {
  ok: boolean;
  error?: string;
  value?: NormalizedFeedback;
}

/** Longest note we keep. */
export const MAX_FEEDBACK_CHARS = 500;

/** The rating scale. Closed set, so the average means something. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

const MODES = ['from-skills', 'from-scratch', 'demo'] as const;

export function isFeedbackVerdict(value: string): value is FeedbackVerdict {
  return (FEEDBACK_VERDICTS as readonly string[]).includes(value);
}

/**
 * Normalises a rating to an integer in [MIN_RATING, MAX_RATING], or 0 when the
 * value is absent or not a real score. A rating is optional: the verdict alone
 * is a complete answer, so a bad value is dropped rather than rejected.
 */
export function normalizeRating(value: number | string | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < MIN_RATING || n > MAX_RATING) return 0;
  return n;
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
      rating: normalizeRating(input.rating),
    },
  };
}

export interface FeedbackRow {
  id: number;
  verdict: string;
  note: string;
  mode: string;
  rating: number;
  created_at: string;
}

export interface FeedbackSummary {
  total: number;
  yes: number;
  partly: number;
  no: number;
  /** Share of answers that were at least partly useful. */
  usefulShare: number;
  /** How many answers carried a rating. */
  rated: number;
  /** Average rating over the rated answers, 0 when there are none. */
  averageRating: number;
  /** Count of each score, index 0 unused; `distribution[3]` is the threes. */
  distribution: number[];
}

/** Aggregates the verdicts into counters, a useful share and the ratings. */
export function summarizeFeedback(rows: { verdict: string; rating?: number }[]): FeedbackSummary {
  const total = rows.length;
  const count = (v: FeedbackVerdict) => rows.filter((r) => r.verdict === v).length;
  const yes = count('yes');
  const partly = count('partly');
  const no = count('no');

  const distribution = new Array<number>(MAX_RATING + 1).fill(0);
  let rated = 0;
  let sum = 0;
  for (const row of rows) {
    const r = normalizeRating(row.rating);
    if (r === 0) continue;
    rated++;
    sum += r;
    distribution[r]++;
  }

  return {
    total,
    yes,
    partly,
    no,
    usefulShare: total > 0 ? (yes + partly) / total : 0,
    rated,
    averageRating: rated > 0 ? sum / rated : 0,
    distribution,
  };
}
