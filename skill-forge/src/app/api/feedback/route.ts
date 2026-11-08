import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateFeedback } from '@/lib/feedback';
import { createFeedback } from '@/lib/feedback-db';

export const runtime = 'nodejs';
export const maxDuration = 15;

interface Body {
  verdict?: string;
  note?: string;
  mode?: string;
}

/**
 * Feedback on a generation: "was this useful, and what is missing?".
 *
 * No sign-in is required: the question is asked of anyone who just generated a
 * skill, including in the anonymous demo, and requiring an account would bias
 * the answers towards the people who already have one. The body carries only a
 * verdict, an optional note and the mode, so there is nothing identifying to
 * protect.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const check = validateFeedback(body);
  if (!check.ok || !check.value) {
    return NextResponse.json({ error: check.error ?? 'Invalid feedback.' }, { status: 400 });
  }

  const id = await createFeedback(check.value);
  if (id === null) {
    return NextResponse.json({ error: 'The feedback could not be saved.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, id });
}
