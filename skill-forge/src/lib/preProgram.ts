/**
 * The founding tester program: one place for the deadline and the perks, so the
 * page and any copy that quotes them cannot drift.
 */
export const preProgram = {
  /** The last day to sign in and still be recognised. */
  deadline: '2026-12-15',
  deadlineLabel: 'December 15, 2026',
  /** Daily generation limit granted to a founding tester. */
  dailyGenerations: 5,
} as const;

/**
 * Exclusive end of the sign-up window: an account created before this instant
 * qualifies. The deadline day itself counts, so the cutoff is the start of the
 * following UTC day.
 */
export const preProgramCutoff = Date.parse('2026-12-16T00:00:00.000Z');

/**
 * True when an account created at `at` still enters the program.
 *
 * The grant is decided once, from the account's creation time (`first_seen`):
 * an account created inside the window keeps the perk for good, one created
 * after it never gets it. That is why the check takes the creation time and not
 * "now".
 */
export function withinPreProgram(at: Date | string | number = Date.now()): boolean {
  const t = at instanceof Date ? at.getTime() : typeof at === 'string' ? Date.parse(at) : at;
  return Number.isFinite(t) && t < preProgramCutoff;
}
