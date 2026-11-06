import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { readQuota } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Identity of the authenticated user, plus their quota.
 *
 * The CLI uses this endpoint for `login` and `whoami`: one call says whether
 * the token is valid, who the user is and how many generations they have left.
 */
export async function GET(req: NextRequest) {
  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json({ error: 'Missing or invalid token.' }, { status: 401 });
  }
  return NextResponse.json({ login, quota: await readQuota(login) });
}
