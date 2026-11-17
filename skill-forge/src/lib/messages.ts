/**
 * User-facing sentences that are shared between the server and the client.
 *
 * They live in one place because the same situation can be observed from both
 * sides — a generation that runs out of time is detected by the route (the
 * budget is spent) and by the browser (the request is abandoned) — and the two
 * must say the same thing, in the same words.
 */

/**
 * Shown when a generation cannot be produced in time.
 *
 * Deliberately short and free of internals: the user cannot act on a list of
 * model names, only on the advice to retry. The technical detail stays in the
 * `fallbacks` field for the operator, not in the sentence the user reads.
 */
export const RETRY_MESSAGE = 'Sorry, retry in a few seconds or hours.';
