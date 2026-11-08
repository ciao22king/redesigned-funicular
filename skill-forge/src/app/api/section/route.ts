import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { runSectionRegeneration, type GenerateBody } from '@/lib/generate';
import { consumeQuota, readQuota } from '@/lib/ratelimit';
import { replaceSection, regenerableSections } from '@/lib/sections';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SECTION_BUDGET_MS = 40_000;

/**
 * Rewrites a single section of a skill.
 *
 * It costs a generation from the daily quota, like a full one: the model call
 * is the same size. The difference is that the rest of the document is
 * preserved, so an edit the user made by hand is never lost.
 */
export async function POST(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'The service is not configured.' }, { status: 500 });
  }

  let body: {
    markdown?: string;
    section?: string;
    instruction?: string;
    audience?: string;
    register?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const markdown = body.markdown ?? '';
  const section = body.section?.trim() ?? '';

  if (!markdown.trim()) return NextResponse.json({ error: 'No document provided.' }, { status: 400 });
  if (!section) return NextResponse.json({ error: 'No section provided.' }, { status: 400 });

  // Only a section the document actually contains may be replaced: this stops
  // a crafted request from appending an arbitrary heading.
  if (!regenerableSections(markdown).some((s) => s.toLowerCase() === section.toLowerCase())) {
    return NextResponse.json({ error: `The document has no section "${section}".` }, { status: 400 });
  }

  const { allowed, quota } = await consumeQuota(login);
  if (!allowed) {
    return NextResponse.json({ error: 'You have used all your generations today.', quota }, { status: 429 });
  }

  const options: GenerateBody = { mode: 'from-skills', audience: body.audience, register: body.register };
  const result = await runSectionRegeneration(
    markdown,
    section,
    (body.instruction ?? '').slice(0, 500),
    SECTION_BUDGET_MS,
    options,
  );
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ markdown: replaceSection(markdown, section, result.body), quota });
}

/** GET: which sections can be regenerated in the given document. */
export async function GET(req: NextRequest) {
  const { token, login } = await getServerAuth(req);
  if (!token || !login) {
    return NextResponse.json({ error: 'You must sign in with GitHub.' }, { status: 401 });
  }
  const markdown = req.nextUrl.searchParams.get('markdown') ?? '';
  return NextResponse.json({ sections: regenerableSections(markdown), quota: await readQuota(login) });
}
