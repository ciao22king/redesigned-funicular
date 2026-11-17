# Reaching creators and developers

The marketplace is only worth browsing if it holds real skills. This is the
plan to fill it: who to contact, what to send, and what to offer in return.

It is written to be used, not admired. Every message below is short enough to
send as it is, and every one of them leads with what the other person gets.

## Who to contact

Three groups, in the order that gives the best return for the effort.

1. **People who already publish skills or prompts in the open.** Anyone with a
   public repository of prompts, an "awesome-" list, a Claude/Cursor rules
   collection, or a `AGENTS.md` they are proud of. They already believe in the
   format; they need a place to publish it.
2. **Teams with a public runbook or onboarding doc.** A company that publishes
   its engineering handbook has already decided the knowledge should be public.
   Their handbook is one generation away from a skill.
3. **Developers who write about a specific workflow.** Someone who wrote a blog
   post on "how we review pull requests" has the material and the audience.

## What to offer

The programme is on the homepage and the rules are public, so the offer is
concrete:

- a **badge** on their author page, earned from published work and stars;
- **featured placement** on the homepage once a skill passes the star threshold;
- **personal stats**: downloads and stars per skill, in their dashboard.

No money, no exclusivity, no lock-in: the skill is Markdown, and they keep it.

## Message templates

Keep them short. The person is doing you a favour by reading.

### To an individual creator

> Subject: your [prompt collection / runbook / rules] as a skill
>
> Hi [name],
>
> I read [specific thing they wrote]. The part that stood out was [one concrete
> detail], and it is exactly the kind of thing that gets lost when it lives in a
> README.
>
> I built Skill Forge, which turns material like that into a structured skill
> for AI agents: a numbered procedure, examples, common mistakes and a checklist.
> You paste the text, it writes the document, and you publish it to a public
> marketplace or download the `.md` and keep it.
>
> If you try it with [their material] and like the result, publishing it would
> give it a home and a download count. If it does not work, I would like to know
> what is missing: I read every reply.
>
> [link to /demo]

### To a team with a public handbook

> Subject: your engineering handbook, as skills your agents can follow
>
> Hi [name],
>
> Your handbook is public and specific, which is rarer than it sounds. The
> review checklist in [page] is the kind of procedure an agent can follow
> directly, but as prose it is easy to skim and skip.
>
> Skill Forge turns a page like that into a skill with a numbered procedure and
> a verification checklist. You can keep the original page as the source of
> truth and regenerate the skill when it changes.
>
> If it is useful, I would be glad to feature it on the homepage. Either way, I
> would value your read on the output.
>
> [link to /use-cases]

### To a developer who wrote about a workflow

> Subject: turning your post on [topic] into a reusable skill
>
> Hi [name],
>
> Your post on [topic] is the clearest explanation of [specific part] I have
> read. It is also, almost word for word, a procedure: the steps are already in
> order.
>
> I built a tool that takes writing like that and produces a skill an agent can
> follow, with the edge cases and the checklist made explicit. Here is your post
> run through it: [link to the generated skill].
>
> If it is accurate, you are welcome to publish it under your name. If it is
> not, the corrections would be genuinely useful to me.
>
> [link to the generated skill]

## How to keep it honest

- **Send the output, not a pitch.** Every template above leads with a real
  result or a real detail. A generic "check out my tool" gets ignored, and it
  should.
- **One follow-up, then stop.** A second message is persistence; a third is
  spam.
- **Feature on merit.** The homepage shows the most starred skills above a
  threshold, and that threshold is in the code (`FEATURED_MIN_STARS`). Do not
  hand-pick around it, or the badge stops meaning anything.
- **Credit the source.** When a skill comes from someone's public writing, say
  so on the skill page and in the message that announces it.

## What "success" looks like

The numbers are on `/stats`, aggregated and cookieless. The signals worth
watching:

- skills published by someone other than the operator;
- downloads per skill, in the creator dashboard;
- the share of visits that reach a generation;
- feedback that says the skill was useful, and the notes that say what is
  missing.

The last one is the most valuable and the easiest to ignore. Read it.
