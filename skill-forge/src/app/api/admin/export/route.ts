import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guardAdminAction } from '@/lib/admin-auth';
import { adminCreators, adminSkills } from '@/lib/admin-db';
import { manualBadgesFor } from '@/lib/creator-db';
import {
  CREATORS_CSV_HEADERS,
  SKILLS_CSV_HEADERS,
  creatorStatus,
  toCsv,
} from '@/lib/admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * CSV export of the creators or the skills.
 *
 * The export is a read, but it is still an admin action: it is guarded, rate
 * limited and audited, because pulling the whole table is exactly the kind of
 * thing the trail should show. Values are escaped for a spreadsheet (see
 * `csvEscape`), so a crafted display name cannot be read as a formula.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') === 'skills' ? 'skills' : 'creators';
  const query = url.searchParams.get('q')?.trim() ?? '';

  const guard = await guardAdminAction(req, 'admin.export', `${type}:${query || 'all'}`);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status, headers: guard.headers });
  }

  let csv: string;
  if (type === 'skills') {
    const rows = await adminSkills({ query, status: 'all', limit: 1000 });
    csv = toCsv(
      SKILLS_CSV_HEADERS,
      rows.map((r) => [
        r.id,
        r.owner,
        r.name,
        r.status,
        r.category,
        r.tags,
        r.stars,
        r.downloads,
        r.createdAt,
        r.updatedAt,
      ]),
    );
  } else {
    const rows = await adminCreators({ query, status: 'all', limit: 1000 });
    const badges = await manualBadgesFor(rows.map((r) => r.login));
    csv = toCsv(
      CREATORS_CSV_HEADERS,
      rows.map((r) => [
        r.login,
        r.displayName,
        creatorStatus(r),
        r.verified ? 'yes' : 'no',
        '',
        (badges.get(r.login) ?? []).join(' '),
        r.published,
        r.stars,
        r.downloads,
        '',
        r.lastSeen,
      ]),
    );
  }

  const filename = `skill-forge-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
