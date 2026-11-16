import { NextResponse } from 'next/server';
import { hostedProvidersEnabled } from '@/lib/providers';

export const runtime = 'nodejs';

/**
 * Whether the hosted providers are switched on.
 *
 * The model picker has to know this before offering "on our servers": showing
 * an option that then fails with a 500 would be worse than not showing it. It
 * exposes one boolean, never which providers or which keys exist.
 */
export async function GET() {
  return NextResponse.json({ hosted: hostedProvidersEnabled() });
}
