import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { runGeneration, runRefine, type GenerateBody } from '@/lib/generate';
import { consumeDemoQuota, quotaMessage, rateLimitHeaders } from '@/lib/ratelimit';
import { checkQuality } from '@/lib/quality';
import { MAX_SOURCE_CHARS } from '@/lib/guardrails';
import { scanText, scanMessages } from '@/lib/scans';
import { normalizeBatch } from '@/lib/metrics';
import { recordMetrics } from '@/lib/metrics-db';

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
const DEMO_BUDGET_MS = 30_000;
const DEMO_REFINE_BUDGET_MS = 15_000;
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

  const scan = scanText(material);
  if (scan.level === 'block') {
    return NextResponse.json(
      {
        error: 'The material contains a harmful payload and was refused.',
        findings: scanMessages(scan),
      },
      { status: 422 },
    );
  }

  const { allowed, quota } = await consumeDemoQuota(clientIp(req));
  if (!allowed) {
    return NextResponse.json(
      { error: quotaMessage(quota, 'demo generations'), quota },
      { status: 429, headers: rateLimitHeaders(quota) },
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

  // Same self-review pass as the signed-in flow, so the preview is the real
  // output and not an approximation of it.
  const refined = await runRefine(result.markdown, { mode: 'from-skills' }, DEMO_REFINE_BUDGET_MS);

  // The demo generation succeeded: recorded here, not from the client beacon.
  await recordMetrics(normalizeBatch([{ event: 'demo_generate' }]));

  return NextResponse.json(
    {
      markdown: refined.markdown,
      model: result.model,
      quality: checkQuality(refined.markdown),
      normalizations: result.normalizations ?? [],
      refined: refined.refined,
      quota,
      warnings: scanMessages(scan),
    },
    { headers: rateLimitHeaders(quota) },
  );
}
