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
  { href: '/pre-program', label: 'Early access' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/tags', label: 'Tags' },
  { href: '/feed.xml', label: 'RSS' },
];

// Single-path brand glyphs (24x24), so each link is one <svg><path/>.
const socialIcons = {
  instagram:
    'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z',
  tiktok:
    'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  devto:
    'M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.83-.26.24-.24.26-.36.26-2.2 0-1.91-.02-1.96-.29-2.18zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-.72.04-.75.03v1.77l1.22.03 1.2.04v1.28h-1.6c-1.53 0-1.6-.01-1.87-.3l-.3-.28v-3.16c0-3.02.01-3.18.25-3.48.23-.31.25-.31 1.85-.31h1.66v1.28zm5.09 6.24h-1.66l-.87-2.55-.89-2.56-.03 2.56-.03 2.55h-1.66V8.53h1.66l.87 2.55.88 2.56.03-2.56.03-2.55h1.67v7.54z',
} as const;

const socialLinks = [
  { href: 'https://www.instagram.com/editbydrix/', label: 'Instagram', icon: socialIcons.instagram },
  { href: 'https://www.tiktok.com/@editbydrix', label: 'TikTok', icon: socialIcons.tiktok },
  { href: 'https://x.com/ImADev22', label: 'X', icon: socialIcons.x },
  { href: 'https://dev.to/imadev22', label: 'dev.to', icon: socialIcons.devto },
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
        <nav aria-label="Social" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {socialLinks.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer me"
              aria-label={s.label}
              title={s.label}
              className="inline-flex items-center gap-2 text-sm text-[--ink-muted] transition-colors hover:text-[--ink]"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor">
                <path d={s.icon} />
              </svg>
              <span>{s.label}</span>
            </a>
          ))}
        </nav>
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
