import type { Metadata } from 'next';
import { Fraunces, Public_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

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
  title: 'Skill Forge · Da note sparse a skill complete',
  description:
    'Trasforma appunti, documenti o un\'idea in una skill completa e dettagliata per agenti AI. Poi scaricala o pubblicala su GitHub.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
