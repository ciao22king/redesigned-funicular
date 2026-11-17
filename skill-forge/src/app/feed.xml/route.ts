import { listSkills } from '@/lib/marketplace-db';
import { toSummary } from '@/lib/marketplace';
import { buildFeed } from '@/lib/feed';
import { siteBase } from '@/lib/site-url';
import { legal } from '@/lib/legal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * RSS 2.0 feed of the newest published skills. The document is built by
 * `lib/feed` so its XML escaping is unit-tested; here we only read D1 and set
 * the response headers.
 */
export async function GET() {
  const base = await siteBase();

  let skills: ReturnType<typeof toSummary>[] = [];
  try {
    const rows = await listSkills({ sort: 'recent', limit: 50 });
    skills = rows.map((row) => toSummary(row));
  } catch {
    // D1 missing (local dev): a valid, empty feed is better than a 500.
    skills = [];
  }

  const feed = buildFeed(skills, {
    base,
    title: `${legal.siteName} · newest skills`,
    description: 'Newly published skills for AI agents on Skill Forge.',
  });

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
}
