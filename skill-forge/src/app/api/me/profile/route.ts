import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { getProfile, saveProfile } from '@/lib/profile-db';
import { toProfileInput, validateProfileInput, type ProfileInput } from '@/lib/profile';
import { recordAudit } from '@/lib/audit-db';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * The signed-in user's own profile: read it, and save the part they control.
 *
 * The login always comes from the session, never from the body, so a person can
 * only ever edit their own profile. The badges and the numbers are not written
 * here: they are derived, so this endpoint only stores what the person wrote.
 */
export async function GET(req: NextRequest) {
  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }
  const profile = await getProfile(login);
  return NextResponse.json({ login, profile, editable: toProfileInput(profile) });
}

export async function POST(req: NextRequest) {
  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }

  let body: ProfileInput;
  try {
    body = (await req.json()) as ProfileInput;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const check = validateProfileInput(body);
  if (!check.ok || !check.value) {
    return NextResponse.json({ error: check.error ?? 'Invalid profile.' }, { status: 400 });
  }

  try {
    const profile = await saveProfile(login, check.value);
    await recordAudit({
      actor: login,
      action: 'profile.update',
      target: login,
      detail: '',
      ip: '',
    });
    return NextResponse.json({ login, profile, editable: toProfileInput(profile) });
  } catch {
    return NextResponse.json(
      { error: 'The profile could not be saved. Please try again.' },
      { status: 503 },
    );
  }
}
