import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { runGeneration, runQuestions, runRefine, type GenerateBody } from '@/lib/generate';
import { consumeQuota, quotaMessage, rateLimitHeaders, readQuota } from '@/lib/ratelimit';
import { checkQuality } from '@/lib/quality';
import { MAX_SOURCE_CHARS } from '@/lib/guardrails';
import { getPreferences } from '@/lib/preferences-db';
import { scanText, scanMessages } from '@/lib/scans';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Time budget for the whole fallback. It must stay below `maxDuration`: so the
 * response (even an error) always goes out, instead of being cut off by the
 * function limit after spending all the time on the models.
 */
const TOTAL_BUDGET_MS = 50_000;

/** Slice of the budget reserved for the self-review pass, after the draft. */
const REFINE_BUDGET_MS = 18_000;

/** Slice of the budget reserved for the clarifying questions, after the draft. */
const QUESTIONS_BUDGET_MS = 10_000;

/** GET: the UI reads the remaining quota without consuming it. */
export async function GET(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }
  const quota = await readQuota(login);
  return NextResponse.json(quota, { headers: rateLimitHeaders(quota) });
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
      {
        error: `The material is ${body.sourceMaterial.length.toLocaleString('en-US')} characters; the maximum is ${MAX_SOURCE_CHARS.toLocaleString('en-US')}. Split it into two generations or remove the least relevant files.`,
        maxChars: MAX_SOURCE_CHARS,
      },
      { status: 413 },
    );
  }

  // Defence in depth: the client scans files before sending them, but a request
  // can be crafted by hand, so the material is scanned again here. A harmful
  // payload is refused; a prompt-injection marker only warns, because the
  // generator already treats the material as data.
  const scan = scanText(body.sourceMaterial ?? '');
  if (scan.level === 'block') {
    return NextResponse.json(
      {
        error: 'The material contains a harmful payload and was refused.',
        findings: scanMessages(scan),
      },
      { status: 422 },
    );
  }

  // The quota is consumed only when the request is valid and the model is
  // about to start: a rejected input does not cost the user a generation.
  const { allowed, quota } = await consumeQuota(login);
  if (!allowed) {
    return NextResponse.json(
      { error: quotaMessage(quota), quota },
      { status: 429, headers: rateLimitHeaders(quota) },
    );
  }

  const result = await runGeneration(body, TOTAL_BUDGET_MS);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Second pass: the model reviews and fixes its own draft. Best-effort, on a
  // fixed slice of the budget; if it fails the draft is returned as it is.
  const refined = await runRefine(result.markdown, body, REFINE_BUDGET_MS);
  const markdown = refined.markdown;

  // The draft is already valid at this point. The clarifying questions are a
  // bonus: they get a small slice of the budget and a failure returns none,
  // never an error, because losing the draft would be far worse.
  const questions = await runQuestions(markdown, QUESTIONS_BUDGET_MS);

  // The opt-out is read here, after the generation: it is reported back so the
  // UI can confirm the choice is in force. It changes nothing about the request
  // itself, because the material is already not retained either way.
  const preferences = await getPreferences(login);

  return NextResponse.json(
    {
      markdown,
      usage: result.usage,
      model: result.model,
      fallbacks: result.fallbacks,
      questions,
      quality: checkQuality(markdown),
      normalizations: result.normalizations ?? [],
      refined: refined.refined,
      quota,
      warnings: scanMessages(scan),
      trainOptOut: preferences.trainOptOut,
    },
    { headers: rateLimitHeaders(quota) },
  );
}
