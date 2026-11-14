/**
 * Changelog.
 *
 * A changelog is only worth reading if it says what changed *for the reader*,
 * so every entry is written as a short note about the effect, not as a list of
 * commits. The data lives here, in one array, so the page, the RSS item and any
 * future "what's new" banner read the same source.
 *
 * The newest entry is first: the page renders the array in order.
 */

export interface ChangelogEntry {
  /** ISO date, so sorting and `datetime` attributes are unambiguous. */
  date: string;
  /** Short title, sentence case. */
  title: string;
  /** One or two sentences: what changed and why it matters. */
  body: string;
  /** `new`, `improved` or `fixed`, used for the small tag. */
  kind: 'new' | 'improved' | 'fixed';
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-11-13',
    kind: 'new',
    title: 'The CLI is on npm',
    body: 'The command-line client is published as @ciao223/skill-forge-cli: npm install -g @ciao223/skill-forge-cli installs the skill-forge and sf commands. The new /cli page documents the install, the GitHub sign-in and every command, and the homepage links to it again.',
  },
  {
    date: '2026-11-10',
    kind: 'new',
    title: 'Public creator profiles',
    body: 'Every author now has a page at /creators with an avatar, a bio, their links, badges and the skills they published, with totals for downloads and stars. You can edit your own name, bio, avatar and links from the dashboard; the author name on every card links to it.',
  },
  {
    date: '2026-11-05',
    kind: 'new',
    title: 'We now measure where people stop, without following you',
    body: 'Visits, generations, downloads and the steps of the flow are counted as daily totals with no cookie and no identifier. The growth page shows the conversion from visit to generation and the point where people leave.',
  },
  {
    date: '2026-11-05',
    kind: 'new',
    title: 'A question after every generation',
    body: 'When a skill appears you can say whether it was useful and what is missing. The note is optional and carries no account, and every note is read.',
  },
  {
    date: '2026-11-05',
    kind: 'new',
    title: 'Creator stats and featured skills',
    body: 'Your dashboard now shows your published skills, stars and downloads, with a badge for what you have earned. The homepage features the most starred skills.',
  },
  {
    date: '2026-11-05',
    kind: 'new',
    title: 'Use cases and this changelog',
    body: 'Five worked cases (code review, incident postmortem, onboarding, customer support, DevOps runbooks) show the material you start from and the skill it becomes. This page keeps the rest of the record.',
  },
  {
    date: '2026-11-05',
    kind: 'new',
    title: 'Trust and safety, in the open',
    body: 'Upload limits, content scanning and the training opt-out are documented on a new Security & Privacy page that quotes the same numbers the server enforces. Every skill now has a Report control.',
  },
  {
    date: '2026-11-05',
    kind: 'new',
    title: 'Three sample skills to start from',
    body: 'Code review, incident postmortem and onboarding now have worked examples you can read before writing your own. Each shows the full output, not a screenshot of it.',
  },
  {
    date: '2026-11-04',
    kind: 'improved',
    title: 'Clarifying questions after the draft',
    body: 'When the material is missing something, the generator asks about it instead of inventing a section. Your answers are folded back in and the skill is rewritten with them.',
  },
  {
    date: '2026-11-04',
    kind: 'new',
    title: 'Rewrite one section at a time',
    body: 'Pick a section, say how to change it, and only that part is regenerated. The rest of the document is left untouched.',
  },
  {
    date: '2026-11-03',
    kind: 'new',
    title: 'Marketplace with a trending ranking',
    body: 'Published skills are ranked by recency, by stars, and by velocity: a skill gaining stars now beats one that collected the same stars months ago.',
  },
];

/** Newest first, which is how the page renders it. */
export function sortedChangelog(): ChangelogEntry[] {
  return [...CHANGELOG].sort((a, b) => b.date.localeCompare(a.date));
}

/** Label for the small kind tag. */
export function kindLabel(kind: ChangelogEntry['kind']): string {
  switch (kind) {
    case 'new':
      return 'New';
    case 'improved':
      return 'Improved';
    default:
      return 'Fixed';
  }
}
