import type { NextAuthOptions } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import GitHubProvider from 'next-auth/providers/github';
import type { NextRequest } from 'next/server';
import { loginForToken, readBearer } from './github-token';
import { recordUser } from './users-db';
import { isLogin } from './users';
import { roleFor, type Role } from './roles';

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? '',
      clientSecret: process.env.GITHUB_SECRET ?? '',
      // Profile read only: skills are published to the Skill Forge marketplace,
      // not to GitHub repositories, so `repo` is not needed.
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }),
  ],
  callbacks: {
    /**
     * Records the sign-in in the `users` table (the landing page shows the
     * count). It never blocks the login: if D1 is unreachable, the person still
     * gets in, only the number misses one row.
     */
    async signIn({ profile }) {
      const login = (profile as { login?: unknown } | undefined)?.login;
      if (isLogin(login)) {
        try {
          await recordUser(login);
        } catch {
          // Best effort: an analytics write must not break authentication.
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      // On first login we store the GitHub access token in the signed JWT,
      // so the API routes use it without a second OAuth round.
      if (account) {
        token.accessToken = account.access_token;
        token.login = (profile as { login?: string } | undefined)?.login;
      }
      // The role is recomputed on every call, so a configuration change (a new
      // founding tester) shows up on the next request without a re-login.
      if (token.login) {
        token.role = roleFor(token.login);
      }
      return token;
    },
    async session({ session, token }) {
      // The OAuth token stays only in the encrypted JWT: the body returned by
      // /api/auth/session is visible to any script on the page, so no secret
      // must appear here. The API routes read the token from the JWT with
      // getServerToken().
      if (session.user) {
        session.user.login = token.login as string | undefined;
        session.user.role = token.role as Role | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
};

/**
 * Reads the GitHub access token and the login, server-side.
 *
 * Due strade:
 *   - the CLI sends `Authorization: Bearer <GitHub token>`, which we verify
 *     contro l'API di GitHub;
 *   - the browser sends the NextAuth session cookie.
 * In both cases the identity comes from the token, never from the request body.
 * Use it only in API routes: the token is never available in the client.
 */
export async function getServerAuth(
  req: NextRequest,
): Promise<{ token?: string; login?: string }> {
  const bearer = readBearer(req);
  if (bearer) {
    const login = await loginForToken(bearer);
    return login ? { token: bearer, login } : {};
  }

  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return {
    token: (jwt?.accessToken as string | undefined) || undefined,
    login: (jwt?.login as string | undefined) || undefined,
  };
}