/**
 * Roles: who the person is, and what that entitles them to.
 *
 * A role is decided from configuration rather than from a database write, so
 * the entitlement check stays pure and synchronous: it cannot fail or slow down
 * when D1 is busy, which matters because it runs on the request path. The same
 * value is written to the user row at sign-in, so the badge the person sees and
 * the entitlement they get cannot drift apart.
 */

export type Role = 'owner' | 'founding_tester' | 'member';

export interface RoleSources {
  /** Logins that operate the service: operator access and no quota. */
  owners: string[];
  /** Early testers: no quota and a badge, but no operator access. */
  foundingTesters: string[];
}

/** Splits a comma-separated list into lowercased, non-empty logins. */
function splitLogins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** Reads the role lists from the environment. */
export function roleSources(env: Record<string, string | undefined> = process.env): RoleSources {
  return {
    owners: splitLogins(env.UNLIMITED_LOGINS ?? 'ciao22king'),
    foundingTesters: splitLogins(env.FOUNDING_TESTERS),
  };
}

/** The role of a login, from the configured lists. */
export function roleFor(login: string, sources: RoleSources = roleSources()): Role {
  const id = login.trim().toLowerCase();
  if (sources.owners.includes(id)) return 'owner';
  if (sources.foundingTesters.includes(id)) return 'founding_tester';
  return 'member';
}

/** True when the role has no daily generation limit at all. */
export function isUnlimitedRole(role: Role): boolean {
  return role === 'owner';
}

/** True when the role is an early tester: a badge and a boosted daily quota. */
export function isFoundingTesterRole(role: Role): boolean {
  return role === 'founding_tester';
}

/** True when the role may see service-wide operator data. */
export function isOperatorRole(role: Role): boolean {
  return role === 'owner';
}

/** Short badge text, or `null` when the role carries no badge. */
export function roleBadge(role: Role): string | null {
  if (role === 'owner') return 'Owner';
  if (role === 'founding_tester') return 'Founding tester';
  return null;
}

/** Full label for a profile. */
export function roleLabel(role: Role): string {
  if (role === 'owner') return 'Owner';
  if (role === 'founding_tester') return 'Founding tester';
  return 'Member';
}

/** Validates a role read back from storage. */
export function isRole(value: unknown): value is Role {
  return value === 'owner' || value === 'founding_tester' || value === 'member';
}
