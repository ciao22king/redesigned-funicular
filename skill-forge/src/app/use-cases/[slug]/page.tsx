import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { USE_CASES, getUseCase, useCasePath } from '@/lib/usecases';
import { legal } from '@/lib/legal';

/**
 * One page per use case.
 *
 * The cases are static data, so each page is prerendered: a search engine or an
 * assistant that lands here gets the whole procedure without waiting for D1.
 * The index at `/use-cases` links to these, so the content has a single home
 * and does not compete with itself.
 */
export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const useCase = getUseCase(slug);
  if (!useCase) return { title: 'Use case not found · Skill Forge' };
  return {
    title: `${useCase.title}: a skill for AI agents · Skill Forge`,
    description: useCase.situation,
    alternates: { canonical: useCasePath(useCase.slug) },
    openGraph: {
      type: 'article',
      title: `${useCase.title} · Skill Forge`,
      description: useCase.situation,
      url: useCasePath(useCase.slug),
    },
  };
}

export default async function UseCasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const useCase = getUseCase(slug);
  if (!useCase) notFound();

  const path = useCasePath(useCase.slug);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${legal.siteUrl}${path}#article`,
        headline: `${useCase.title}: a skill for AI agents`,
        description: useCase.situation,
        url: `${legal.siteUrl}${path}`,
        inLanguage: 'en',
        about: useCase.audience,
        isPartOf: { '@type': 'WebSite', name: legal.siteName, url: legal.siteUrl },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: legal.siteUrl },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Use cases',
            item: `${legal.siteUrl}/use-cases`,
          },
          { '@type': 'ListItem', position: 3, name: useCase.title, item: `${legal.siteUrl}${path}` },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Structured data only: `JSON.stringify` of a plain object, no user HTML.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[--ink-muted]">
            <li>
              <Link href="/use-cases" className="transition-colors hover:text-[--accent]">
                Use cases
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-[--ink]">{useCase.title}</li>
          </ol>
        </nav>

        <header>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[--ink]">
            {useCase.title}
          </h1>
          <p className="mt-3 max-w-prose text-[15px] text-[--ink-muted]">{useCase.audience}</p>
        </header>

        <div className="hairline my-10" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[--line] bg-[--surface-raised] p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
              The situation
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[--ink]">{useCase.situation}</p>
          </div>
          <div className="rounded-xl border border-[--line] bg-[--surface-raised] p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
              What you start from
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[--ink]">{useCase.input}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[--line] bg-[--surface-sunken] p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[--ink-muted]">
            What the skill does
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[--ink]">{useCase.outcome}</p>
        </div>

        <div className="mt-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[--ink]">
            The steps it enforces
          </h2>
          <ol className="mt-3 space-y-2">
            {useCase.steps.map((step, j) => (
              <li key={j} className="flex gap-3 text-sm text-[--ink]">
                <span className="font-mono text-[--accent]">{j + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="hairline my-12" />

        <div className="rounded-2xl border border-[--accent] bg-[--accent-soft] p-6">
          <h2 className="font-display text-xl font-semibold text-[--ink]">
            Turn your own notes into this skill
          </h2>
          <p className="mt-2 max-w-prose text-sm text-[--ink]">
            Paste the material you already have into the demo, or sign in to keep, edit and
            publish the result.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Try the demo
            </Link>
            <Link
              href="/use-cases"
              className="rounded-xl border border-[--line] bg-[--surface-raised] px-5 py-3 text-sm font-medium text-[--ink] transition-colors hover:bg-[--surface-sunken]"
            >
              All use cases
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
