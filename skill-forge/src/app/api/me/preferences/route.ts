import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { getPreferences, setTrainOptOut } from '@/lib/preferences-db';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * The user's preferences: today, only whether their material may be used to
 * improve the service and the models.
 *
 * GET reads them, POST changes the opt-out flag. Only the signed-in user's own
 * preferences are ever touched: the login comes from the session, never from
 * the body.
 */
export async function GET(req: NextRequest) {
  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }
  return NextResponse.json(await getPreferences(login));
}

export async function POST(req: NextRequest) {
  const { login } = await getServerAuth(req);
  if (!login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }

  let body: { trainOptOut?: boolean };
  try {
    body = (await req.json()) as { trainOptOut?: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (typeof body.trainOptOut !== 'boolean') {
    return NextResponse.json({ error: '`trainOptOut` must be true or false.' }, { status: 400 });
  }

  try {
    const prefs = await setTrainOptOut(login, body.trainOptOut);
    return NextResponse.json(prefs);
  } catch {
    return NextResponse.json(
      { error: 'The preference could not be saved. Please try again.' },
      { status: 503 },
    );
  }
}
