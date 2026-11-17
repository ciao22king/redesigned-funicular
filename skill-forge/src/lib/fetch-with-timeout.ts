/**
 * Fetching the generator, with a ceiling on the wait.
 *
 * A generation can be slow — several models are tried, then a self-review pass
 * runs — and when the platform or a provider stalls, the browser is left on a
 * spinner with no explanation. Rather than that, the wait is bounded: past the
 * ceiling the request is abandoned and the user gets a plain sentence telling
 * them to retry.
 *
 * The ceiling is deliberately generous (two minutes). It is not a timeout meant
 * to trigger in normal use: a healthy generation finishes well within it. It is
 * the point past which waiting longer is worse than an honest message.
 */
import { RETRY_MESSAGE } from './messages';

export { RETRY_MESSAGE };

/** How long to wait before giving up and telling the user to retry. */
export const GENERATION_TIMEOUT_MS = 120_000;

/** Thrown when a request exceeds the ceiling. */
export class TimedOutError extends Error {
  constructor() {
    super(RETRY_MESSAGE);
    this.name = 'TimedOutError';
  }
}

/**
 * `fetch` with an abort-based deadline. On timeout it throws `TimedOutError`,
 * whose message is already the sentence to show the user.
 *
 * `AbortSignal.timeout` is not used directly because it is not present on every
 * runtime this code runs on; an `AbortController` works everywhere and lets the
 * caller keep its own signal.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = GENERATION_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    // An abort surfaces as an AbortError; anything else (a network drop) is
    // also worth the same retry advice, since the user can do nothing else.
    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new TimedOutError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
