import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { runGeneration, type GenerateBody } from '@/lib/generate';
import { consumeDemoQuota } from '@/lib/ratelimit';
import { MAX_SOURCE_CHARS } from '@/lib/guardrails';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Public demo: it generates a skill preview with no sign-in, so a visitor sees
 * the real output before being asked for a GitHub account.
 *
 * It reuses the exact generation core of the authenticated endpoint, so the
 * preview is never a watered-down version. Only the budget is smaller and the
 * material is capped harder, because the caller is anonymous.
 */
const DEMO_BUDGET_MS = 40_000;
const DEMO_MAX_CHARS = 4_000;
const DEMO_MAX_TOKENS = 1_800;

/**
 * Client address, used only to rate limit the demo. Cloudflare sets
 * `cf-connecting-ip`; the header fallback keeps the route usable behind a proxy.
 */
function clientIp(req: NextRequest): string {
  const direct = req.headers.get('cf-connecting-ip');
  if (direct) return direct.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: 'The demo is not available right now. Please try again later.' },
      { status: 503 },
    );
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (body.mode !== 'from-skills') {
    return NextResponse.json({ error: 'The demo only accepts pasted material.' }, { status: 400 });
  }

  const material = body.sourceMaterial?.trim() ?? '';
  if (!material) {
    return NextResponse.json({ error: 'No material provided.' }, { status: 400 });
  }
  if (material.length > DEMO_MAX_CHARS) {
    return NextResponse.json(
      { error: `The demo accepts up to ${DEMO_MAX_CHARS} characters. Sign in for longer material.` },
      { status: 413 },
    );
  }
  if (material.length > MAX_SOURCE_CHARS) {
    return NextResponse.json({ error: 'Material too long.' }, { status: 413 });
  }

  const { allowed, quota } = await consumeDemoQuota(clientIp(req));
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          'You have reached the demo limit for today. Sign in with GitHub to keep generating.',
        quota,
      },
      { status: 429 },
    );
  }

  const result = await runGeneration(
    { mode: 'from-skills', sourceMaterial: material },
    DEMO_BUDGET_MS,
    DEMO_MAX_TOKENS,
  );
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ markdown: result.markdown, model: result.model, quota });
}
