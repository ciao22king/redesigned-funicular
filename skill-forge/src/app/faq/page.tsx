import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { legal } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'FAQ · Skill Forge',
  description:
    'What a skill for AI agents is, how generation works, what it costs, where your material goes, and how the marketplace and the CLI fit in.',
  alternates: { canonical: '/faq' },
  openGraph: {
    type: 'article',
    title: 'FAQ · Skill Forge',
    description:
      'What a skill is, how generation works, what it costs, where your material goes, and how the marketplace and the CLI fit in.',
    url: '/faq',
  },
};

/**
 * The questions people actually ask, with answers that stay true to the
 * product: free quotas, the GitHub sign-in, the OpenRouter gateway and the
 * no-storage privacy promise. The same strings feed the FAQPage JSON-LD, so
 * they are plain text — the links live in the "Useful links" block below.
 */
const FAQS: { q: string; a: string }[] = [
  {
    q: 'What exactly is a "skill"?',
    a: 'A skill is a single Markdown file that teaches an AI agent one job: when to use it, when not to, what to check first, the numbered procedure to follow, rules and constraints, worked examples, the common mistakes, and a final checklist. Agents read it as instructions, so the quality of the output stops depending on how well you phrase a single prompt.',
  },
  {
    q: 'How does Skill Forge generate a skill?',
    a: 'You bring the raw material — scattered notes, a document, a chat export, or just a sentence describing the job. Skill Forge sends it to an AI model through the OpenRouter gateway and returns a complete, structured skill instead of a loose prompt. If the material is incomplete, the skill lists what is missing and which questions would close the gap, rather than inventing facts.',
  },
  {
    q: 'Is Skill Forge free?',
    a: 'Yes. You can generate 3 skills per day with a free account, and founding testers get 5 per day. The marketplace is free to browse, search and download without any account at all.',
  },
  {
    q: 'Do I need an account to try it?',
    a: 'No. The demo generates a real skill preview from the text you paste, with no account and no sign-in. You only need to sign in with GitHub to generate complete skills, publish to the marketplace or use the CLI.',
  },
  {
    q: 'Which AI agents can use the generated skills?',
    a: 'Any agent that reads Markdown instructions: Claude Code, Codex, OpenHands, Amp, Cline and similar coding agents, plus general assistants that accept custom instructions. You download the skill as a .md file and point your agent at it, or publish it so teammates can pull the same file.',
  },
  {
    q: 'What happens to the material I paste or upload?',
    a: 'It is sent to the AI provider to generate the skill and is not stored on the Skill Forge servers afterwards. Do not paste proprietary code, customer data, passwords or confidential documents — the full detail is in the privacy policy.',
  },
  {
    q: 'What is the marketplace?',
    a: 'A public catalogue of skills published by users: browse and search without an account, download any skill as Markdown, star the ones you use, and find skills by tag or author. Publishing a skill of your own takes one GitHub sign-in.',
  },
  {
    q: 'Is there a command-line interface?',
    a: 'Yes: npm install -g @ciao223/skill-forge-cli installs the skill-forge command (short form sf). From the terminal you can sign in with GitHub, generate a skill from a file or from text, publish it, and pull skills from the marketplace.',
  },
  {
    q: 'How do I get started?',
    a: 'Paste a few messy notes into the demo and look at what comes back. If it is close to what you need, sign in with GitHub and generate the full skill — you can download it immediately or publish it to the marketplace.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'FAQPage',
      '@id': `${legal.siteUrl}/faq#faq`,
      url: `${legal.siteUrl}/faq`,
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: legal.siteName, url: legal.siteUrl },
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: legal.siteUrl },
        { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${legal.siteUrl}/faq` },
      ],
    },
  ],
};

const usefulLinks = [
  { href: '/demo', label: 'Try the demo' },
  { href: '/use-cases', label: 'Browse the use cases' },
  { href: '/marketplace', label: 'Explore the marketplace' },
  { href: '/cli', label: 'Install the CLI' },
  { href: '/privacy', label: 'Read the privacy policy' },
];

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Structured data only: `JSON.stringify` of a plain object, no user HTML.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-6 py-14">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-[--accent]">
          FAQ
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[--ink]">
          Questions people ask before their first skill
        </h1>
        <p className="mt-5 max-w-prose text-[17px] text-[--ink-muted]">
          What a skill is, what it costs, where your material goes. If your
          question is not here, the{' '}
          <Link href="/use-cases" className="text-[--accent] underline underline-offset-2">
            use cases
          </Link>{' '}
          show the whole flow on real examples.
        </p>

        <div className="mt-10">
          {FAQS.map((f) => (
            <section key={f.q} className="hairline py-6 first:pt-0">
              <h2 className="text-lg font-semibold text-[--ink]">{f.q}</h2>
              <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-[--ink-muted]">
                {f.a}
              </p>
            </section>
          ))}
        </div>

        <div className="hairline my-10" />

        <nav aria-label="Useful links" className="flex flex-wrap gap-2">
          {usefulLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border border-[--line] bg-[--surface-raised] px-3.5 py-1.5 text-xs text-[--ink-muted] transition-colors hover:border-[--accent] hover:text-[--ink]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </main>
      <Footer />
    </>
  );
}
