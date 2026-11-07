import type { Metadata, Viewport } from 'next';
import { Fraunces, Public_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/Providers';
import { legal } from '@/lib/legal';

// Cloudflare Web Analytics: aggregate, cookieless page views. The token is a
// public site tag, safe in the client bundle like GITHUB_ID. Empty disables the
// beacon (for example on a local build).
const ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN ?? '9d40be2ece8d4cb0be14e47e1c2f2039';

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
  // Google Search Console verification. The matching TXT record lives in the
  // skillforge.eu.org zone, but until the NS delegation from eu.org is active
  // that domain does not resolve: meanwhile the meta tag covers the workers.dev
  // domain. Two tokens: each verifies its own property in Search Console, and
  // Google ignores the ones it does not need.
  verification: {
    google: [
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[--accent] focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
        {ANALYTICS_TOKEN ? (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: ANALYTICS_TOKEN })}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
