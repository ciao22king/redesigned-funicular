import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[--line] py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-sm text-[--ink-muted] sm:flex-row sm:items-center sm:justify-between">
        <p>Skill Forge · costruito con Next.js</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/termini" className="transition-colors hover:text-[--ink]">
            Termini di servizio
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-[--ink]">
            Privacy
          </Link>
          <Link href="/cookie" className="transition-colors hover:text-[--ink]">
            Cookie
          </Link>
        </nav>
      </div>
    </footer>
  );
}
