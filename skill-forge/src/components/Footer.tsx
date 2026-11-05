import Link from 'next/link';
import { legal } from '@/lib/legal';

const legalLinks = [
  { href: '/note-legali', label: 'Note legali' },
  { href: '/termini', label: 'Termini' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookie', label: 'Cookie' },
  { href: '/accessibilita', label: 'Accessibilità' },
  { href: '/sicurezza', label: 'Sicurezza' },
  { href: '/contatti', label: 'Contatti' },
];

export function Footer() {
  const year = new Date().getFullYear();
  const range = year > legal.since ? `${legal.since}–${year}` : `${legal.since}`;
  return (
    <footer className="mt-16 border-t border-[--line] py-10">
      <div className="mx-auto max-w-6xl px-6">
        <nav
          aria-label="Informazioni legali"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[--ink-muted]"
        >
          {legalLinks.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[--ink]">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hairline my-5" />
        <div className="flex flex-col gap-2 text-sm text-[--ink-muted] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {range} {legal.owner.name === '[Nome e cognome o ragione sociale]' ? legal.siteName : legal.owner.name}. Tutti i diritti riservati.
          </p>
          <p className="font-mono text-xs">Skill Forge · costruito con Next.js</p>
        </div>
      </div>
    </footer>
  );
}
