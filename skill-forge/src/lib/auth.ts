import type { NextAuthOptions } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import GitHubProvider from 'next-auth/providers/github';
import type { NextRequest } from 'next/server';

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? '',
      clientSecret: process.env.GITHUB_SECRET ?? '',
      // `repo` non serve solo a leggere il profilo: serve per creare
      // repository e committare le skill generate.
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Al primo login salviamo l'access token GitHub nel JWT firmato,
      // così le route API lo usano senza un secondo giro OAuth.
      if (account) {
        token.accessToken = account.access_token;
        token.login = (profile as { login?: string } | undefined)?.login;
      }
      return token;
    },
    async session({ session, token }) {
      // Il token OAuth resta solo nel JWT cifrato: il corpo restituito da
      // /api/auth/session e' visibile a qualunque script in pagina, quindi qui
      // NON deve comparire nessun segreto. Le route API leggono il token dal
      // JWT con getServerToken().
      if (session.user) {
        session.user.login = token.login as string | undefined;
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
 * Legge l'access token GitHub e il login dal JWT cifrato, lato server.
 * Va usata solo nelle route API: il token non e' mai disponibile nel client.
 */
export async function getServerAuth(
  req: NextRequest,
): Promise<{ token?: string; login?: string }> {
  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return {
    token: (jwt?.accessToken as string | undefined) || undefined,
    login: (jwt?.login as string | undefined) || undefined,
  };
}