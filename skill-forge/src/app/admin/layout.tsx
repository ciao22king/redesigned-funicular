import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { Nav } from '@/components/Nav';

/**
 * The admin area.
 *
 * Access is the closed login list in `admin.ts`: a signed-in visitor who is not
 * on it gets a 404 (the area does not advertise itself), and an anonymous one is
 * sent to the homepage. Every page under here is noindex/nofollow, so the panel
 * never reaches a search engine even if a link leaks.
 *
 * This is a server guard, so the check happens before any page data is read.
 */
export const metadata: Metadata = {
  title: 'Admin · Skill Forge',
  robots: { index: false, follow: false, nocache: true },
};

const SECTIONS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/creators', label: 'Creators' },
  { href: '/admin/skills', label: 'Skills' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/audit', label: 'Audit log' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const login = session?.user?.login;
  if (!login) redirect('/');
  if (!isAdmin(login)) notFound();

  return (
    <>
      <Nav />
      <div className="border-b border-[--line] bg-[--surface-sunken]">
        <nav
          aria-label="Admin"
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2 sm:px-6"
        >
          <span className="mr-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[--accent]">
            Admin
          </span>
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-lg px-3 py-1.5 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-raised] hover:text-[--ink]"
            >
              {s.label}
            </Link>
          ))}
          <span className="ml-auto font-mono text-xs text-[--ink-muted]">@{login}</span>
        </nav>
      </div>
      {children}
    </>
  );
}
