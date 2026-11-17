import { getDatabase, type D1Like } from './d1';
import type { FeedbackRow, NormalizedFeedback } from './feedback';

/**
 * D1 access for feedback. Same conventions as the other `*-db` modules: the
 * database is injectable and a failure degrades instead of breaking the page.
 */

/** Inserts one feedback entry. Returns the new id, or null on failure. */
export async function createFeedback(
  feedback: NormalizedFeedback,
  injected?: D1Like,
): Promise<number | null> {
  try {
    const database = await getDatabase(injected);
    const result = (await database
      .prepare(
        `INSERT INTO feedback (verdict, note, mode, rating, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(feedback.verdict, feedback.note, feedback.mode, feedback.rating, new Date().toISOString())
      .run()) as { meta?: { last_row_id?: number } } | undefined;
    return Number(result?.meta?.last_row_id ?? 0) || null;
  } catch {
    return null;
  }
}

/** The most recent entries, for the owner to read. */
export async function listFeedback(
  limit = 200,
  injected?: D1Like,
): Promise<FeedbackRow[]> {
  const database = await getDatabase(injected);
  const result = await database
    .prepare('SELECT id, verdict, note, mode, rating, created_at FROM feedback ORDER BY id DESC LIMIT ?')
    .bind(Math.min(Math.max(limit, 1), 1000))
    .all<FeedbackRow>();
  return result.results ?? [];
}

/** Only the verdict and the rating, which is all the summary needs. */
export async function feedbackVerdicts(
  limit = 5000,
  injected?: D1Like,
): Promise<{ verdict: string; rating: number }[]> {
  const database = await getDatabase(injected);
  const result = await database
    .prepare('SELECT verdict, rating FROM feedback LIMIT ?')
    .bind(Math.min(Math.max(limit, 1), 50000))
    .all<{ verdict: string; rating: number }>();
  return result.results ?? [];
}
