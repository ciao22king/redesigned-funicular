import type { DefaultSession } from 'next-auth';
import type { Role } from '@/lib/roles';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user?: {
      login?: string;
      role?: Role;
      /** Display-only: whether the Nav shows the Admin link. */
      admin?: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    login?: string;
    role?: Role;
  }
}
