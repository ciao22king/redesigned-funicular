/**
 * Worked use cases.
 *
 * Each one is a concrete situation with the material a person would actually
 * have, and the skill it turns into. They are real examples, not feature
 * descriptions: the reader should be able to say "that is my Tuesday" and try
 * it with their own notes.
 *
 * The data lives here so the page, the homepage teaser and the sitemap read the
 * same list.
 */

export interface UseCase {
  /** URL-safe id, used in the anchor and the deep link. */
  slug: string;
  /** Short name of the domain, used in the nav and the cards. */
  title: string;
  /** Who it is for, in one line. */
  audience: string;
  /** The situation, as a person would describe it. */
  situation: string;
  /** The messy material they start from. */
  input: string;
  /** What the generated skill does, in two or three sentences. */
  outcome: string;
  /** The concrete steps of the generated skill, as a short list. */
  steps: string[];
}

export const USE_CASES: UseCase[] = [
  {
    slug: 'code-review',
    title: 'Code review',
    audience: 'A team that reviews pull requests and keeps missing the same things.',
    situation:
      'Reviews drift: one person checks the tests, another only the style, and the changelog is forgotten until after the release. The knowledge of what a good review checks lives in people\'s heads.',
    input:
      'A few review comments from last month, the team\'s unwritten rules, and the last two incidents that a review could have caught.',
    outcome:
      'A skill that turns a pull request into one comment with two lists: blocking issues and suggestions. It names the file and line for every blocker, and it refuses to approve when the changelog and the version disagree with the code.',
    steps: [
      'Read the full diff before commenting; never review from the description.',
      'Check the changelog entry for every user-visible change.',
      'Confirm the version bump matches the change.',
      'Verify migrations have a down-migration.',
      'Post one comment, blockers separated from suggestions.',
    ],
  },
  {
    slug: 'incident-postmortem',
    title: 'Incident postmortem',
    audience: 'An on-call engineer who has to write the postmortem while the details are still fresh.',
    situation:
      'The incident channel has a hundred messages, a timeline in someone\'s memory and a draft that reads like a defence instead of an explanation.',
    input:
      'The incident channel export, the alert that fired first, and the deploy log for the hours around it.',
    outcome:
      'A skill that reconstructs a timeline from the messages, separates the trigger from the contributing causes, and writes the postmortem with action items that each have an owner and a date. It refuses to name a single root cause when the evidence shows several.',
    steps: [
      'Build the timeline from timestamps in the channel, not from memory.',
      'Separate the trigger from the contributing conditions.',
      'State the customer impact with numbers, not adjectives.',
      'Write action items that are specific and owned.',
      'List what was unknown at the time, so the response is judged fairly.',
    ],
  },
  {
    slug: 'onboarding',
    title: 'Onboarding',
    audience: 'A team that repeats the same setup explanation to every new joiner.',
    situation:
      'The onboarding doc is out of date, the real steps live in a senior engineer\'s head, and every new person loses the first two days to the same questions.',
    input:
      'The current onboarding doc, the last month of questions asked in the team channel, and the setup script comments.',
    outcome:
      'A skill that produces an ordered onboarding procedure with a verification step after each stage, so a new person knows they succeeded before moving on. It flags the steps that are outdated instead of repeating them.',
    steps: [
      'Order the steps so each one is verifiable on its own.',
      'Give the exact command and the expected output for each stage.',
      'List the access to request, and from whom.',
      'Include a "you are done when" check for the end of day one.',
      'Mark the parts that are known to be stale.',
    ],
  },
  {
    slug: 'customer-support',
    title: 'Customer support',
    audience: 'A support team answering the same class of ticket over and over.',
    situation:
      'A ticket comes in, the first reply is a generic script, and the customer replies that nobody read their message. The real cause was in the ticket all along.',
    input:
      'The ticket thread, the earlier generic reply, and the notes from the engineer who diagnosed it.',
    outcome:
      'A skill that separates the symptom from the explanation, forms at most two hypotheses with the evidence for each, and writes a reply that ends with a concrete next step and an owner. It never sends the generic script when the ticket already contains a clue.',
    steps: [
      'Restate the symptom without a cause.',
      'Pull out the reproduction conditions, including the ones that look incidental.',
      'Form at most two hypotheses, each with its evidence.',
      'Acknowledge and correct any earlier generic advice.',
      'End the reply with the next step and who owns it.',
    ],
  },
  {
    slug: 'devops-runbook',
    title: 'DevOps runbook',
    audience: 'A team that runs a service and needs a procedure anyone on call can follow.',
    situation:
      'The knowledge of how to restart, scale and roll back the service is spread across three people, and at 3am the person on call is not one of them.',
    input:
      'Past runbooks, the deployment scripts, and the chat threads from the last two times the service was recovered.',
    outcome:
      'A skill that writes a runbook with a decision point at the top: which symptom leads to which procedure. Every command is copy-pasteable, and every procedure ends with how to confirm the service is healthy again.',
    steps: [
      'Start with a symptom-to-procedure table, not a wall of commands.',
      'Give each command in full, with the expected output.',
      'Include the rollback for every change the runbook makes.',
      'End each procedure with a health check.',
      'Note the steps that require a second person.',
    ],
  },
  {
    slug: 'writing-docs',
    title: 'Documentation',
    audience: 'A maintainer whose docs lag two versions behind the code and who is the only one who notices.',
    situation:
      'The README describes an API that no longer exists, the good documentation is scattered across issue threads, and "update the docs" has been on the backlog for a quarter because nobody knows where to start.',
    input:
      'The current README, the doc comments in the recently changed files, and the questions people actually asked in the support channel last month.',
    outcome:
      'A skill that rewrites the documentation around the questions people really ask, anchors every command to the version it applies to, and refuses to publish a page that contradicts the code it just read.',
    steps: [
      'Collect the real questions first; they define the sections.',
      'Read the code for every claim before writing it.',
      'Mark each command with the version it applies to.',
      'Delete the sections that answer questions nobody asks.',
      'End each page with a runnable verification step.',
    ],
  },
  {
    slug: 'test-generation',
    title: 'Test coverage',
    audience: 'A developer who inherited a codebase whose only tests were written by an abandoned tool.',
    situation:
      'Coverage says twelve percent, the happy paths are verified by hand before every release, and every regression reaches production before anyone notices it.',
    input:
      'The untested module, the bug reports from the last two months, and the manual checklist the team runs before a release.',
    outcome:
      'A skill that turns each bug report into a failing regression test first, covers the manual checklist with real integration tests, and refuses to write assertions that mirror the implementation instead of the contract.',
    steps: [
      'Write the regression test for a reported bug before touching the fix.',
      'Convert every manual checklist item into an automated test.',
      'Assert the contract, not the private internals.',
      'Name each test after the behaviour it protects.',
      'Flag the paths that still have no test and say why.',
    ],
  },
  {
    slug: 'legacy-refactoring',
    title: 'Legacy refactoring',
    audience: 'A developer asked to change a module nobody has touched in three years.',
    situation:
      'The file is two thousand lines, the comments contradict the code, and every change risks the one customer who depends on the undocumented behaviour.',
    input:
      'The legacy module, whatever tests exist, the commit history of the recent changes, and the support tickets filed against it.',
    outcome:
      'A skill that maps the actual behaviour first — including the undocumented cases the tickets reveal — then plans the refactor as steps that each keep the observable behaviour identical, with a verification after every move.',
    steps: [
      'Record the current behaviour, including the edge cases from tickets.',
      'Pin it down with characterisation tests before editing anything.',
      'Plan the refactor as steps, each of which compiles and passes.',
      'Verify the observable behaviour is unchanged after every step.',
      'Document the behaviour that surprised you, so the next person reads it.',
    ],
  },
  {
    slug: 'api-onboarding',
    title: 'API integration',
    audience: 'A developer integrating a third-party API whose docs assume context they do not have.',
    situation:
      'The quickstart works until the first real request, the auth errors are vague, and the rate limits live in a changelog post from two years ago.',
    input:
      'The API quickstart, the auth errors from your first attempts, and the notes from whoever used the API before you.',
    outcome:
      'A skill that builds a verified request sequence: auth first, then one endpoint at a time with the expected response shape written before the call. It records the rate limits and retry policy it could actually confirm, and flags everything it could not.',
    steps: [
      'Authenticate first and record what a valid token looks like.',
      'Call one endpoint at a time; write the expected shape before the call.',
      'Confirm the rate limits from responses, not from memory.',
      'Record the retry policy for each error code you actually saw.',
      'List the behaviours you could not verify as open questions.',
    ],
  },
  {
    slug: 'release-notes',
    title: 'Release notes',
    audience: 'A release manager writing notes from a month of merged pull requests.',
    situation:
      'Thirty merges, three of them reverted, and the notes alternate between "various fixes" and a changelog nobody reads because everything is marked as minor.',
    input:
      'The merged pull requests since the last release, the draft changelog entries, and the issues each pull request claims to close.',
    outcome:
      'A skill that groups the changes by what a user actually notices, writes each entry from the diff instead of the pull request title, and marks the entries that require user action. Reverted work disappears; security fixes get their own section.',
    steps: [
      'Group by user-visible effect, not by component.',
      'Write each entry from the diff, not from the PR title.',
      'Mark the entries that require the user to act.',
      'Drop the reverted work entirely.',
      'Give security fixes their own section at the top.',
    ],
  },
];

/** Looks up a use case by its slug. */
export function getUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find((u) => u.slug === slug);
}

/** The canonical address of a use case page. */
export function useCasePath(slug: string): string {
  return `/use-cases/${slug}`;
}
