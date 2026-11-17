import type { NextRequest } from 'next/server';

const GH = 'https://api.github.com';

/**
 * Authentication for the CLI.
 *
 * The CLI cannot use the browser session cookie, so it sends a GitHub token as
 * `Authorization: Bearer <token>`. Here we read it and verify it against the
 * GitHub API: the identity stays that of the token owner, never the one the
 * client claims.
 *
 * A token is verified on every request. That is fine: the call is
 * authenticated, so it consumes the user's GitHub quota, not ours, and an
 * invalid token answers 401 right away.
 */
export function readBearer(req: NextRequest): string | undefined {
  const header = req.headers.get('authorization');
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || undefined;
}

/** Returns the GitHub login of the token owner, or undefined if invalid. */
export async function loginForToken(token: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${GH}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // The CLI does not send a User-Agent, so we set it explicitly:
        // without it, the GitHub API rejects the request.
        'User-Agent': 'skill-forge-cli',
      },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { login?: unknown };
    return typeof data.login === 'string' ? data.login : undefined;
  } catch {
    return undefined;
  }
}
