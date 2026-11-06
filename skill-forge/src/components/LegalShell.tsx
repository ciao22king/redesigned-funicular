import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <header className="mb-10">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[--ink-muted]">
            Legal document
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[--ink]">
            {title}
          </h1>
          <p className="mt-3 text-sm text-[--ink-muted]">Last updated: {updated}</p>
          <div className="hairline mt-6" />
        </header>
        <article className="legal space-y-5 text-[15px] leading-relaxed text-[--ink]">
          {children}
        </article>
      </main>
      <Footer />
    </>
  );
}
