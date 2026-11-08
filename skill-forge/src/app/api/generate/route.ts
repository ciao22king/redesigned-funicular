import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { runGeneration, runQuestions, type GenerateBody } from '@/lib/generate';
import { consumeQuota, readQuota } from '@/lib/ratelimit';
import { checkQuality } from '@/lib/quality';
import { MAX_SOURCE_CHARS } from '@/lib/guardrails';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Time budget for the whole fallback. It must stay below `maxDuration`: so the
 * response (even an error) always goes out, instead of being cut off by the
 * function limit after spending all the time on the models.
 */
const TOTAL_BUDGET_MS = 50_000;

/** Slice of the budget reserved for the clarifying questions, after the draft. */
const QUESTIONS_BUDGET_MS = 12_000;

/** GET: the UI reads the remaining quota without consuming it. */
export async function GET(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }
  return NextResponse.json(await readQuota(login));
}

export async function POST(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY is not configured on the server.' },
      { status: 500 },
    );
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (body.mode !== 'from-skills' && body.mode !== 'from-scratch') {
    return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
  }
  if (body.mode === 'from-skills' && !body.sourceMaterial?.trim()) {
    return NextResponse.json({ error: 'No material provided.' }, { status: 400 });
  }
  if (
    body.mode === 'from-scratch' &&
    (!body.name?.trim() || !body.domain?.trim() || !body.goal?.trim())
  ) {
    return NextResponse.json({ error: 'Name, domain and goal are required.' }, { status: 400 });
  }
  if (body.sourceMaterial && body.sourceMaterial.length > MAX_SOURCE_CHARS) {
    return NextResponse.json(
      { error: `Material too long: maximum ${MAX_SOURCE_CHARS} characters.` },
      { status: 413 },
    );
  }

  // The quota is consumed only when the request is valid and the model is
  // about to start: a rejected input does not cost the user a generation.
  const { allowed, quota } = await consumeQuota(login);
  if (!allowed) {
    const retryAfter = Math.max(0, Math.ceil((Date.parse(quota.resetsAt) - Date.now()) / 1000));
    return NextResponse.json(
      {
        error: `You have used all ${quota.limit} generations today. The quota resets on ${new Date(
          quota.resetsAt,
        ).toLocaleString('en-US', { timeZone: 'UTC' })} UTC.`,
        quota,
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const result = await runGeneration(body, TOTAL_BUDGET_MS);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // The draft is already valid at this point. The clarifying questions are a
  // bonus: they get a small slice of the budget and a failure returns none,
  // never an error, because losing the draft would be far worse.
  const questions = await runQuestions(result.markdown, QUESTIONS_BUDGET_MS);

  return NextResponse.json({
    markdown: result.markdown,
    usage: result.usage,
    model: result.model,
    fallbacks: result.fallbacks,
    questions,
    quality: checkQuality(result.markdown),
    quota,
  });
}
