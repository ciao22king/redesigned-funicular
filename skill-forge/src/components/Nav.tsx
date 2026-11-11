'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { RoleBadge } from '@/components/RoleBadge';

export function Nav() {
  const { data: session, status } = useSession();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[--line] bg-[--surface]/85 backdrop-blur-sm">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-[22px] font-semibold tracking-tight text-[--ink]">
            Skill Forge
          </span>
          <span
            aria-hidden
            className="h-[7px] w-[7px] rounded-full bg-[--accent] transition-transform duration-200 group-hover:scale-125"
          />
        </Link>

        {/* Desktop actions */}
        <div className="hidden items-center gap-1 md:flex">
          <Link
            href="/demo"
            className="rounded-lg px-3 py-2 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
          >
            Demo
          </Link>
          <Link
            href="/marketplace"
            className="rounded-lg px-3 py-2 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
          >
            Marketplace
          </Link>
          <Link
            href="/creators"
            className="rounded-lg px-3 py-2 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
          >
            Creators
          </Link>
          <Link
            href="/tags"
            className="rounded-lg px-3 py-2 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
          >
            Tags
          </Link>
          <Link
            href="/use-cases"
            className="rounded-lg px-3 py-2 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
          >
            Use cases
          </Link>
          <Link
            href="/pre-program"
            className="rounded-lg px-3 py-2 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
          >
            Early access
          </Link>
          {status === 'authenticated' ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
              >
                My skills
              </Link>
              <Link
                href="/create/from-skills"
                className="rounded-lg bg-[--accent] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Create a skill
              </Link>

              <div className="relative ml-2">
                <button
                  type="button"
                  onClick={() => setMenu((v) => !v)}
                  aria-expanded={menu}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-[--surface-sunken]"
                >
                  {session?.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt=""
                      className="h-8 w-8 rounded-full border border-[--line]"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[--accent-soft] text-xs font-semibold text-[--accent]">
                      {(session?.user?.name ?? 'U').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </button>

                {menu && (
                  <div
                    role="menu"
                    className="surface-card absolute right-0 mt-2 w-56 animate-fade-in p-1.5 shadow-lg"
                  >
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium text-[--ink]">
                        {session?.user?.name ?? 'User'}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-[--ink-muted]">
                        @{session?.user?.login ?? 'github'}
                        <RoleBadge role={session?.user?.role} />
                      </p>
                    </div>
                    <div className="hairline my-1" />
                    <Link
                      href="/dashboard"
                      role="menuitem"
                      onClick={() => setMenu(false)}
                      className="block rounded-md px-3 py-2 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
                    >
                      My skills
                    </Link>
                    {session?.user?.login && (
                      <Link
                        href={`/creators/${session.user.login}`}
                        role="menuitem"
                        onClick={() => setMenu(false)}
                        className="block rounded-md px-3 py-2 text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
                      >
                        My public profile
                      </Link>
                    )}
                    {session?.user?.admin && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        onClick={() => setMenu(false)}
                        className="block rounded-md px-3 py-2 text-sm font-medium text-[--accent] transition-colors hover:bg-[--surface-sunken]"
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => signIn('github')}
              className="flex items-center gap-2 rounded-lg border border-[--line] bg-[--surface-raised] px-4 py-2 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
            >
              <GitHubMark />
              Sign in with GitHub
            </button>
          )}
        </div>

        {/* Mobile: one menu button instead of a row of clipped links */}
        <button
          type="button"
          onClick={() => setMobile((v) => !v)}
          aria-expanded={mobile}
          aria-controls="mobile-menu"
          aria-label={mobile ? 'Close menu' : 'Open menu'}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[--line] bg-[--surface-raised] text-[--ink] transition-colors hover:bg-[--surface-sunken] md:hidden"
        >
          <BurgerIcon open={mobile} />
        </button>
      </nav>

      {mobile && (
        <div
          id="mobile-menu"
          className="border-t border-[--line] bg-[--surface] px-4 py-3 md:hidden"
        >
          <div className="flex flex-col">
            <Link
              href="/demo"
              onClick={() => setMobile(false)}
              className="rounded-lg px-3 py-3 text-sm text-[--ink] transition-colors hover:bg-[--surface-sunken]"
            >
              Demo
            </Link>
            <Link
              href="/marketplace"
              onClick={() => setMobile(false)}
              className="rounded-lg px-3 py-3 text-sm text-[--ink] transition-colors hover:bg-[--surface-sunken]"
            >
              Marketplace
            </Link>
            <Link
              href="/creators"
              onClick={() => setMobile(false)}
              className="rounded-lg px-3 py-3 text-sm text-[--ink] transition-colors hover:bg-[--surface-sunken]"
            >
              Creators
            </Link>
            <Link
              href="/tags"
              onClick={() => setMobile(false)}
              className="rounded-lg px-3 py-3 text-sm text-[--ink] transition-colors hover:bg-[--surface-sunken]"
            >
              Tags
            </Link>
            <Link
              href="/use-cases"
              onClick={() => setMobile(false)}
              className="rounded-lg px-3 py-3 text-sm text-[--ink] transition-colors hover:bg-[--surface-sunken]"
            >
              Use cases
            </Link>
            {status === 'authenticated' ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobile(false)}
                  className="rounded-lg px-3 py-3 text-sm text-[--ink] transition-colors hover:bg-[--surface-sunken]"
                >
                  My skills
                </Link>
                <Link
                  href="/create/from-skills"
                  onClick={() => setMobile(false)}
                  className="mt-2 rounded-lg bg-[--accent] px-4 py-3 text-center text-sm font-medium text-white"
                >
                  Create a skill
                </Link>
                <div className="hairline my-3" />
                <p className="truncate px-3 text-sm font-medium text-[--ink]">
                  {session?.user?.name ?? 'User'}
                </p>
                <p className="truncate px-3 pb-2 text-xs text-[--ink-muted]">
                  @{session?.user?.login ?? 'github'}
                </p>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="rounded-lg px-3 py-3 text-left text-sm text-[--ink-muted] transition-colors hover:bg-[--surface-sunken] hover:text-[--ink]"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => signIn('github')}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-[--line] bg-[--surface-raised] px-4 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
              >
                <GitHubMark />
                Sign in with GitHub
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {open ? (
        <>
          <path d="M4 4l10 10" />
          <path d="M14 4L4 14" />
        </>
      ) : (
        <>
          <path d="M2.5 5h13" />
          <path d="M2.5 9h13" />
          <path d="M2.5 13h13" />
        </>
      )}
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
