/**
 * Sample material and the skill it produces.
 *
 * The homepage "Before / After" renders the pair statically: it must be in the
 * HTML, without a model call, so a crawler and a first-time visitor see it
 * immediately. The demo page reuses the same `raw` text as a starting point.
 */

export interface Sample {
  id: string;
  label: string;
  /** The messy input, as a person would write it. */
  raw: string;
  /** The skill the generator produces from it. */
  skill: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'standup',
    label: 'Team standup notes',
    raw: `standup notes - tuesday

- deploy still broken, someone needs to check the migration on staging
- we keep forgetting to update the changelog before release
- Marco: the API returns 500 when the token expires, should return 401
- idea: add a health endpoint, we never know if the worker is up
- last release we forgot to bump the version in package.json, again
- retro action from 2 weeks ago is still open

the annoying part is always the same: we merge, then realize the docs and the
version are wrong, then we patch after the release. should be part of the PR.`,
    skill: `---
name: release-readiness-check
description: Verify a pull request is release-ready before merging, catching missing changelog, version bumps and broken migrations.
---

# Release readiness check

## When to use it

- A pull request is about to be merged into the release branch.
- The user asks "is this ready to ship?" or "can we merge this?".
- The team has merged something and then had to patch the release afterwards.

## When NOT to use it

- Draft pull requests that are not meant to be merged.
- Purely editorial changes with no code, no version and no migration.

## Prerequisites

- Read access to the pull request diff.
- The version file of the project (\`package.json\`, \`Cargo.toml\`, and so on).
- The changelog file, if the project keeps one.

## Procedure

1. Read the full diff before commenting. Do not review from the description.
2. Check whether the change is user-visible. If it is, the changelog must have
   an entry in this same pull request. If it is missing, that is a blocker.
3. Check the version file. If the change is user-visible and the version is not
   bumped, that is a blocker. Report the current value and the expected one.
4. Look for database migrations. If one is present, confirm it was applied on
   staging and that the down-migration exists.
5. Verify that any new endpoint returns the correct status codes. A missing or
   expired credential must return 401, not 500.
6. Confirm the test suite covers the changed behaviour. A new endpoint with no
   test is a blocker.
7. Post a single comment with two lists: blocking issues and suggestions.
   Every blocking item must name the file and the line.

## Rules and constraints

- Never approve a pull request whose changelog and version are inconsistent
  with the code. This is the mistake the team makes most often.
- Do not comment on formatting if a formatter is configured. The formatter owns
  that decision.
- One comment, not a stream of small ones.

## Examples

### Input

A pull request that adds a health endpoint, with no changelog entry and no
version bump.

### Expected output

Blocking: \`src/app/api/health/route.ts:1\`, new endpoint with no test.
Blocking: \`CHANGELOG.md\`, no entry for a user-visible change.
Blocking: \`package.json:3\`, version still 1.4.2.
Suggestion: the endpoint could also report the build id, useful when debugging.

## Common mistakes

- Treating the changelog and the version as follow-up work. They are part of the
  pull request, not a later task.
- Reviewing only the added lines and missing a removed guard.
- Approving when the migration has no down-migration.

## Missing information

- Which branch is the release branch? Ask, so the check targets the right base.
- Is there a CI job that already enforces the version bump? If yes, the manual
  check is redundant and the question is why CI did not fail.

## Final checklist

- [ ] Changelog entry present for every user-visible change
- [ ] Version bumped when the change is user-visible
- [ ] Migration applied on staging, with a down-migration
- [ ] New endpoints return 401 on expired credentials, not 500
- [ ] Tests cover the new behaviour
- [ ] One comment posted, with blockers separated from suggestions`,
  },
  {
    id: 'support',
    label: 'Customer support thread',
    raw: `ticket 4821 - customer angry

they say the export button gives an empty file. happened 3 times this week.
one user said it works if they wait and click again. another said csv opens in
excel with everything in one column.

we told them to clear cache (standard answer), did not help.

i checked: the export runs async and the file is generated after the response,
so if the browser navigates away too early you get a 0 byte file. the one
column thing is probably the separator, we use commas but their excel expects
semicolons.

need a reply that does not sound like we are guessing, and we should fix this
properly not keep patching.`,
    skill: `---
name: support-ticket-triage
description: Diagnose a support ticket from evidence, separate symptom from cause, and reply with a concrete next step instead of a generic script.
---

# Support ticket triage

## When to use it

- A customer reports a bug, especially one reported more than once.
- The first reply must go out and the team does not yet know the cause.
- A ticket contains a plausible but unverified explanation.

## When NOT to use it

- Feature requests with no malfunction.
- Tickets that only need a refund or a billing action.

## Prerequisites

- The full ticket thread, including any earlier reply from the team.
- Access to the application logs or a way to reproduce.

## Procedure

1. Restate the symptom in one sentence, using only what the customer observed.
   Do not include a cause yet.
2. Separate the symptom from the explanation. In the example, "empty file" is
   the symptom; "async generation" is a hypothesis. Keep them apart.
3. List the reproduction conditions the customer described, including the ones
   that look incidental. "Works if they wait and click again" is not incidental,
   it is the strongest clue in the ticket.
4. Check whether the ticket contradicts an earlier reply. If the team already
   sent a generic script, say so and correct it.
5. Form at most two hypotheses, each with the evidence that supports it.
6. Identify the concrete next step: what the customer does, and what the team
   does. Both must be specific.
7. Write the reply in plain language. No "we are investigating" without a date
   or an owner.

## Rules and constraints

- Never send a generic troubleshooting script (clear the cache, try another
  browser) when the ticket already contains a specific clue. It signals that
  nobody read the message.
- Do not state a cause as fact before it is confirmed. Write "this matches",
  not "this is".
- Every reply ends with the next step and who owns it.

## Examples

### Input

A ticket saying an export produces an empty file, reported three times, and the
customer already received a cache-clearing script that did not help.

### Expected output

Symptom: the exported file is empty (0 bytes).
Evidence: waiting and clicking again produces a valid file, which points to the
file being generated after the response.
Hypothesis 1: the browser leaves the page before generation ends.
Hypothesis 2: the CSV separator does not match the customer's spreadsheet
settings, which also explains "everything in one column".
Next step: we ship a change so the export waits for the file; meanwhile we ask
the customer for the exact time of the last attempt, to confirm in the logs.
Reply acknowledges that the cache advice was wrong for this case.

## Common mistakes

- Answering the loudest sentence in the ticket instead of the reported symptom.
- Treating a workaround reported by the customer as noise.
- Promising a fix with no date and no owner.

## Missing information

- Which browser and version? Ask, it decides between the two hypotheses.
- Does the customer's spreadsheet use a semicolon list separator? Ask, it is a
  regional setting and cannot be inferred from the ticket.

## Final checklist

- [ ] Symptom restated without a cause
- [ ] Hypotheses supported by evidence from the ticket
- [ ] Earlier generic advice acknowledged and corrected
- [ ] Next step named, with an owner
- [ ] No cause stated as confirmed before verification`,
  },
];

/** The sample shown first, used as the default in the demo. */
export const DEFAULT_SAMPLE = SAMPLES[0];
