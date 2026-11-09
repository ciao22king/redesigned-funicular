import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { readQuota } from '@/lib/ratelimit';
import { roleBadge, roleFor, roleLabel } from '@/lib/roles';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Identity of the authenticated user, plus their quota and role.
 *
 * The CLI uses this endpoint for `login` and `whoami`: one call says whether
 * the token is valid, who the user is, how many generations they have left and
 * what role they hold.
 */
export async function GET(req: NextRequest) {
  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json({ error: 'Missing or invalid token.' }, { status: 401 });
  }
  const role = roleFor(login);
  return NextResponse.json({
    login,
    role,
    roleLabel: roleLabel(role),
    badge: roleBadge(role),
    quota: await readQuota(login),
  });
}
