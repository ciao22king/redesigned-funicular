import type { Metadata, Viewport } from 'next';
import { Fraunces, Public_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { VisitTracker } from '@/components/VisitTracker';
import { legal } from '@/lib/legal';

// Cloudflare Web Analytics: aggregate, cookieless page views. This is the
// skillforge.cc.cd site *token*, not its site tag — the tag is not a beacon
// credential and the collector rejects it, which is why the dashboard stayed
// empty. The beacon posts to this zone's own /cdn-cgi/rum, the ingestion path
// for a zone-proxied site. Empty disables the beacon (for example on a local
// build).
const ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN ?? 'd0f7addd4052409cbb0f1e496ce8fc56';

// Display: variable serif with character, not Inter, not Roboto
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
    default: 'Skill Forge · From scattered notes to complete skills',
    template: '%s',
  },
  description:
    'Turn notes, documents or a single idea into a complete, detailed skill for AI agents. Then download it or publish it to the marketplace.',
  applicationName: 'Skill Forge',
  keywords: ['skill', 'AI', 'agents', 'prompt', 'documentation', 'GitHub'],
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
  // Google Search Console verification. Each token verifies its own property
  // and Google ignores the ones it does not need. The apex TXT record for
  // skillforge.cc.cd lives in its own zone; these meta tags cover the property
  // served from this origin.
  verification: {
    google: [
      'BdX3KzeudlL_Vyb1p_70F1_Bhl93NGoNPHhxw5CMIFU',
      'hg9z_CJS5ZLTdubmXqF8Mpae1XwhXgDqjpXOJ5PXJ14',
      'WcvnFbGkas_gCmkPeSXXrEoYusWceo4fWNDxkWT1dVE',
    ],
  },
  openGraph: {
    type: 'website',
    siteName: 'Skill Forge',
    locale: 'en_US',
    url: legal.siteUrl,
    title: 'Skill Forge · From scattered notes to complete skills',
    description:
      'Turn notes, documents or a single idea into a complete, detailed skill for AI agents.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Skill Forge · From scattered notes to complete skills',
    description:
      'Turn notes, documents or a single idea into a complete skill for AI agents.',
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

// Site-wide structured data: tells search engines what this site is and which
// name to use for it, so the sitelinks/knowledge panel has a canonical entity.
const siteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: legal.siteName,
  url: legal.siteUrl,
  description:
    'Turn notes, documents or a single idea into a complete, detailed skill for AI agents.',
  inLanguage: 'en',
  publisher: {
    '@type': 'Organization',
    name: legal.siteName,
    url: legal.siteUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          // Structured data only: `JSON.stringify` of a plain object, no user HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[--accent] focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <VisitTracker />
        {ANALYTICS_TOKEN ? (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({
              token: ANALYTICS_TOKEN,
              // A zone-proxied site ingests RUM first-party; the beacon's
              // default third-party collector rejects this token.
              send: { to: '/cdn-cgi/rum' },
            })}
          />
        ) : null}
      </body>
    </html>
  );
}
