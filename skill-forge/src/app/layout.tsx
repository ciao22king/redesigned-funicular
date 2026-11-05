import type { Metadata, Viewport } from 'next';
import { Fraunces, Public_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { legal } from '@/lib/legal';

// Display: serif variabile con carattere, non Inter, non Roboto
const display = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '600', '700'],
});

const body = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  metadataBase: new URL(legal.siteUrl),
  title: {
    default: 'Skill Forge · Da note sparse a skill complete',
    template: '%s',
  },
  description:
    "Trasforma appunti, documenti o un'idea in una skill completa e dettagliata per agenti AI. Poi scaricala o pubblicala su GitHub.",
  applicationName: 'Skill Forge',
  keywords: ['skill', 'AI', 'agenti', 'prompt', 'documentazione', 'GitHub'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Skill Forge',
    locale: 'it_IT',
    url: legal.siteUrl,
    title: 'Skill Forge · Da note sparse a skill complete',
    description:
      "Trasforma appunti, documenti o un'idea in una skill completa e dettagliata per agenti AI.",
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Skill Forge · Da note sparse a skill complete',
    description:
      "Trasforma appunti, documenti o un'idea in una skill completa per agenti AI.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#c25a3a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans antialiased">
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[--accent] focus:px-4 focus:py-2 focus:text-white"
        >
          Salta al contenuto
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
