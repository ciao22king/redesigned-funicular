import Link from 'next/link';
import { legal } from '@/lib/legal';

const legalLinks = [
  { href: '/terms', label: 'Terms of service' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/security', label: 'Security & Privacy' },
  { href: '/cookie', label: 'Cookie policy' },
];

const exploreLinks = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/use-cases', label: 'Use cases' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/tags', label: 'Tags' },
  { href: '/feed.xml', label: 'RSS' },
];

export function Footer() {
  const year = new Date().getFullYear();
  const range = year > legal.since ? `${legal.since}–${year}` : `${legal.since}`;
  return (
    <footer className="mt-16 border-t border-[--line] py-10">
      <div className="mx-auto max-w-6xl px-6">
        <nav
          aria-label="Explore"
          className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[--ink-muted]"
        >
          {exploreLinks.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[--ink]">
              {l.label}
            </Link>
          ))}
        </nav>
        <nav
          aria-label="Legal information"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[--ink-muted]"
        >
          {legalLinks.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[--ink]">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hairline my-5" />
        <p className="mb-4 max-w-prose text-xs text-[--ink-muted]">
          Material you submit is sent to our AI provider to generate the skill and
          is not stored on our servers afterwards. Full detail in the{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[--ink]">
            privacy policy
          </Link>
          . Do not upload proprietary code, customer data, passwords or
          confidential documents.
        </p>
        <div className="flex flex-col gap-2 text-sm text-[--ink-muted] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {range} {legal.owner.name}. Personal project.
          </p>
          <p className="font-mono text-xs">Skill Forge · built with Next.js</p>
        </div>
      </div>
    </footer>
  );
}
