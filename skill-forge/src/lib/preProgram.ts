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
