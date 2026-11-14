/**
 * User preferences, stored on D1.
 *
 * Today there is one: whether the material the user submits may be used to
 * improve the service and the models. The default is `true`, because that is
 * what the privacy policy states and what most people expect from a free tool,
 * but the switch is explicit and one click away in the dashboard.
 *
 * The type is pure so the rule ("what does opting out actually change") can be
 * tested without a database.
 */

export interface Preferences {
  /** May the submitted material be used to improve the service and models? */
  trainOptOut: boolean;
  updatedAt?: string;
}

/** What a user has when they never touched the setting. */
export const DEFAULT_PREFERENCES: Preferences = { trainOptOut: false };

export interface PreferenceRow {
  login: string;
  train_opt_out: number;
  updated_at: string;
}

export function toPreferences(row: PreferenceRow | null): Preferences {
  if (!row) return { ...DEFAULT_PREFERENCES };
  return { trainOptOut: Number(row.train_opt_out) === 1, updatedAt: row.updated_at };
}

/**
 * What opting out changes, in one place so the UI text and the behaviour cannot
 * drift.
 *
 * It is important to be precise: the material is already not stored after the
 * response, and it is already never used by us to train anything (we do not
 * train models). What opting out changes is that the submission is not retained
 * in any evaluation or debugging sample, and the audit line for the user's
 * actions keeps no detail beyond the target.
 */
export const OPT_OUT_EFFECT =
  'When this is on, your submissions are never kept in evaluation or debugging samples, ' +
  'and the audit records of your actions keep only the target, no detail.';
