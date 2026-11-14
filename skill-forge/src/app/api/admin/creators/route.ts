import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminIdentity, guardAdminAction } from '@/lib/admin-auth';
import {
  getProfile,
  setProfileModeration,
  setProfileVerified,
  setVerifiedSocials,
} from '@/lib/profile-db';
import { grantBadge, revokeBadge } from '@/lib/creator-db';
import { isCreatorStatus } from '@/lib/admin';
import { isLogin } from '@/lib/users';
import { SOCIAL_KEYS, isManualBadgeId, type SocialKey } from '@/lib/profile';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface Body {
  login?: string;
  action?: 'verify' | 'social' | 'badge' | 'status';
  verified?: boolean;
  social?: string;
  socialVerified?: boolean;
  badge?: string;
  granted?: boolean;
  status?: string;
}

/**
 * Admin actions on a creator: verify, confirm a social link, grant or revoke a
 * badge, and suspend or ban.
 *
 * The target login and the action come from the body, but the actor comes from
 * the guard, so a moderator cannot forge who acted. Every branch writes its own
 * audit line through the guard, so the trail names the exact change.
 */
export async function POST(req: NextRequest) {
  // Identity first: an anonymous request is refused before its body is read.
  const identity = await adminIdentity(req);
  if (!identity) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const login = (body.login ?? '').trim();
  if (!isLogin(login)) {
    return NextResponse.json({ error: 'Invalid creator login.' }, { status: 400 });
  }

  switch (body.action) {
    case 'verify': {
      const guard = await guardAdminAction(req, 'admin.creator.verify', login, identity);
      if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status, headers: guard.headers });
      }
      const ok = await setProfileVerified(login, Boolean(body.verified));
      if (!ok) return NextResponse.json({ error: 'Could not update the profile.' }, { status: 503 });
      return NextResponse.json({ ok: true, verified: Boolean(body.verified) });
    }

    case 'social': {
      const key = (body.social ?? '').trim() as SocialKey;
      if (!SOCIAL_KEYS.includes(key)) {
        return NextResponse.json({ error: 'Unknown social link.' }, { status: 400 });
      }
      const guard = await guardAdminAction(req, 'admin.creator.social', `${login}:${key}`, identity);
      if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status, headers: guard.headers });
      }

      const profile = await getProfile(login);
      const current = new Set(profile.verifiedSocials);
      if (body.socialVerified) current.add(key);
      else current.delete(key);
      const ok = await setVerifiedSocials(login, [...current]);
      if (!ok) return NextResponse.json({ error: 'Could not update the profile.' }, { status: 503 });
      return NextResponse.json({ ok: true, verifiedSocials: [...current] });
    }

    case 'badge': {
      const badge = (body.badge ?? '').trim();
      if (!isManualBadgeId(badge)) {
        return NextResponse.json({ error: 'Unknown badge.' }, { status: 400 });
      }
      const guard = await guardAdminAction(req, 'admin.creator.badge', `${login}:${badge}`, identity);
      if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status, headers: guard.headers });
      }

      if (body.granted) {
        const ok = await grantBadge(login, badge, guard.login);
        if (!ok) return NextResponse.json({ error: 'Could not grant the badge.' }, { status: 503 });
      } else {
        await revokeBadge(login, badge);
      }
      return NextResponse.json({ ok: true, badge, granted: Boolean(body.granted) });
    }

    case 'status': {
      const status = (body.status ?? '').trim();
      if (!isCreatorStatus(status)) {
        return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
      }
      const guard = await guardAdminAction(req, 'admin.creator.status', `${login}:${status}`, identity);
      if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status, headers: guard.headers });
      }

      const ok = await setProfileModeration(login, {
        suspended: status === 'suspended',
        banned: status === 'banned',
      });
      if (!ok) return NextResponse.json({ error: 'Could not update the profile.' }, { status: 503 });
      return NextResponse.json({ ok: true, status });
    }

    default:
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
}
