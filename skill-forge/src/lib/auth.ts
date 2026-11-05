import type { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';

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
      session.accessToken = token.accessToken as string | undefined;
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