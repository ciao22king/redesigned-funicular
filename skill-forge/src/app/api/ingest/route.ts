import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  fetchGitHubRepo,
  fetchPublicText,
  googleExportUrl,
  isGitHubUrl,
  isGoogleUrl,
  isNotionUrl,
  validatePublicUrl,
} from '@/lib/sources';
import { consumeIngestQuota } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Turns a source the user named into text the generator can use: a public URL,
 * a GitHub repository, a Google Doc or a Notion page.
 *
 * This endpoint only fetches and returns text. It never generates, so a failure
 * here costs nothing and the client can show the error next to the field.
 */

/** Notion has no public text export; its API needs a token we do not hold. */
const NOTION_HINT =
  'A Notion page cannot be read without an integration token. Open the page, use "Export" → "Markdown & CSV", and paste or upload the file instead.';

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  let payload: { url?: string };
  try {
    payload = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const raw = payload.url?.trim() ?? '';
  if (!raw) return NextResponse.json({ error: 'No URL provided.' }, { status: 400 });

  // Only an absolute URL is accepted: the UI is expected to normalise a bare
  // "github.com/owner/repo" before sending it.
  if (!/^https?:\/\//i.test(raw)) {
    return NextResponse.json({ error: 'The URL must start with http:// or https://.' }, { status: 400 });
  }

  const { allowed, quota } = await consumeIngestQuota(clientIp(req));
  if (!allowed) {
    return NextResponse.json(
      { error: 'You have fetched too many sources today. Sign in to keep working.', quota },
      { status: 429 },
    );
  }

  // Notion is answered before any network call: there is nothing we could fetch.
  if (isNotionUrl(raw)) {
    return NextResponse.json(
      { error: NOTION_HINT, kind: 'notion', needsManual: true, quota },
      { status: 422 },
    );
  }

  if (isGitHubUrl(raw)) {
    const result = await fetchGitHubRepo(raw);
    if (!result.ok) return NextResponse.json({ error: result.error, quota }, { status: 502 });
    return NextResponse.json({
      text: result.text,
      kind: 'github',
      finalUrl: result.finalUrl,
      truncated: result.truncated,
      quota,
    });
  }

  const target = isGoogleUrl(raw) ? (googleExportUrl(raw) ?? raw) : raw;
  const invalid = validatePublicUrl(target);
  if (invalid) return NextResponse.json({ error: invalid, quota }, { status: 400 });

  const result = await fetchPublicText(target);
  if (!result.ok) return NextResponse.json({ error: result.error, quota }, { status: 502 });

  return NextResponse.json({
    text: result.text,
    kind: isGoogleUrl(raw) ? 'google' : 'url',
    finalUrl: result.finalUrl,
    truncated: result.truncated,
    quota,
  });
}
