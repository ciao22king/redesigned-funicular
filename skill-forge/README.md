# Skill Forge

Turn scattered notes, documents or a simple idea into a complete, detailed skill
for AI agents. Then download it as `.md` or publish it straight to the
marketplace.

## What it does

| Mode | Input | Output |
| --- | --- | --- |
| **A. From existing material** | Up to 20 files (`.md`, `.txt`, `.json`, `.pdf`, code, SRT/VTT transcripts) or pasted text | One skill that merges all the material, identifies missing information and asks targeted questions, and keeps the technical details |
| **B. From scratch** | 6-field wizard (name, domain, goal, tone, constraints, examples) | A complete skill with a numbered procedure, examples, common mistakes, checklist |

Every generated skill has this structure:

```
YAML frontmatter (name, description)
When to use it / When NOT to use it
Prerequisites
Procedure
Rules and constraints
Examples (input + expected output)
Common mistakes
Final checklist
```

## Why the output is better than a one-shot chat

The same model, asked in a chat window, returns a plausible answer. Here it goes
through three deterministic layers that a chat prompt does not have:

1. **Pre-processing** (`lib/preprocess.ts`). A transcript is converted from SRT
   or VTT into prose, with consecutive turns from one speaker merged and the cue
   numbers and timestamps removed. Messy notes are tidied: BOM, decorative
   separator lines and page markers are dropped. The model then spends its
   budget on the procedure, not on re-formatting the input.
2. **A self-review pass** (`runRefine` in `lib/generate.ts`). After the draft,
   the model critiques and rewrites it against a rubric (each step one action, no
   invented facts, concrete examples, no hedging). Best-effort and on a fixed
   slice of the budget: if it fails, the draft stands.
3. **Deterministic normalisation** (`lib/normalize.ts`). Whatever the model
   returns, the result is guaranteed to have canonical frontmatter, the required
   sections in the required order, no em dashes, and a final checklist
   synthesised from the procedure when the model forgot one. The pass is
   idempotent, so it can run after both the draft and the review without drift.

A draft that is still missing the sections that carry the content (When to use
it, Procedure, Examples) is rejected and the model ladder moves on, rather than
shipping a document that reads well and executes nothing.

## Real-world input

Beyond plain text and code, two input shapes are handled exactly rather than by
asking the model to guess:

- **PDF** (`lib/pdf.ts`): the text is extracted from the content streams, with
  FlateDecode inflated through the platform's own `DecompressionStream`. No
  dependency, and it works in the Worker runtime. A scan or an exotic font CMap
  is reported as unreadable instead of producing noise.
- **Transcripts** (`.srt`, `.vtt`): converted to prose before generation.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **NextAuth 4** with the GitHub provider (profile read only)
- **OpenRouter** as the AI gateway, OpenAI-compatible, with fallback across free models
- **Tailwind CSS 3** with a warm OKLCH palette
- Deploy on **Cloudflare Workers** through the `@opennextjs/cloudflare` adapter

## CLI

You can also use the service from the terminal. The CLI lives in [`cli/`](cli/)
and is a separate Node package with no runtime dependencies:

```bash
npm install -g @ciao223/skill-forge-cli
skill-forge login
cat note.md | skill-forge generate --quiet | skill-forge publish --tags docker
```

Generate, publish, search and download skills. Details in
[`cli/README.md`](cli/README.md).

Browsing the marketplace and reading any skill page needs no account. Taking
the `.md` file does: the download route requires a GitHub sign-in, so the
traffic stays tied to real people instead of anonymous scrapers. Copy and fork
stay open.

## Run locally

```bash
npm install
cp .env.example .env.local
# fill in .env.local (see below)
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

| Variable | Where to find it |
| --- | --- |
| `GITHUB_ID` | [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) |
| `GITHUB_SECRET` | Same page, after creating the app |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` locally, the Worker URL in production |
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys), key `gsk_...` |
| `GROQ_MODELS` | Optional. Comma-separated Groq model ids, fastest first |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys), key `sk-or-v1-...` |
| `OPENROUTER_MODELS` | Optional. Comma-separated model ids, fastest first |

Both providers speak the OpenAI protocol and are driven by the same client. The
ladder tries Groq first, then OpenRouter, and skips any provider whose key is
unset: **one key is enough**, and setting both means a Groq outage still answers
through OpenRouter. See `src/lib/providers.ts` for the default model ladders.

### Create the GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. **New OAuth App**
3. **Homepage URL**: `http://localhost:3000`
4. **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
5. Copy `Client ID` and `Client Secret` into `.env.local`

For production, create a **second** OAuth App (or update the callback) with:

```
https://<your-worker>.<subdomain>.workers.dev/api/auth/callback/github
```

## Deploy on Cloudflare Workers

The project uses the [OpenNext adapter for Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/),
because `next-auth` v4 needs the Node APIs (`nodejs_compat`) that the adapter
enables in the Worker.

### Via Git (recommended)

1. Push the project to GitHub
2. Cloudflare → **Workers & Pages** → **Create** → **Import a repository**
3. Pick the repo. Cloudflare reads `wrangler.jsonc` on its own
4. In **Settings → Variables and Secrets** add all the variables from the table
   above, with `NEXTAUTH_URL` set to the final URL
5. Deploy

### Via CLI

```bash
npm i -g wrangler
wrangler login
wrangler secret put NEXTAUTH_SECRET
wrangler secret put GITHUB_ID
wrangler secret put GITHUB_SECRET
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GROQ_API_KEY
npm run deploy
```

### Development in the Workers runtime

```bash
# .dev.vars with the same variables as .env.local
npm run preview   # build + preview in the workerd runtime
```

## Automatic deploy

Every push to `main` builds the project and publishes it to Cloudflare Workers
through `.github/workflows/deploy.yml`. One-time setup:

```bash
bash scripts/setup-deploy.sh
```

The script creates the GitHub repo, uploads the repository secrets and prints the
expected Worker URL. Full details, including the secrets to set by hand, are in
[docs/DEPLOY.md](docs/DEPLOY.md).

Workflow flow:

```
push to main  ->  verify job (npm ci + next build)  ->  deploy job (opennextjs-cloudflare deploy)
```

If the build fails, the deploy does not start and production stays on the last
working version. From the Actions tab you can run it by hand in preview mode.

## Structure

```
.github/workflows/deploy.yml   verify and deploy to Cloudflare Workers
docs/DEPLOY.md                 full guide to the automatic deploy
scripts/setup-deploy.sh        onboarding: repo, worker, secrets
scripts/check-env.mjs          variable check before push
wrangler.jsonc                 Worker configuration
open-next.config.ts            OpenNext adapter configuration
src/
├── app/
│   ├── page.tsx                     Landing page with the two modes
│   ├── create/from-skills/page.tsx  Mode A
│   ├── create/from-scratch/page.tsx Mode B
│   ├── dashboard/page.tsx           Where the skills end up
│   ├── marketplace/page.tsx         Storefront: search, sort, stars
│   ├── tags/page.tsx                Tag index (most used first)
│   ├── tags/[tag]/page.tsx          Skills carrying one tag
│   ├── u/[owner]/page.tsx           All skills of one author
│   ├── s/[owner]/[slug]/page.tsx    Public page of a single skill
│   ├── feed.xml/route.ts            RSS feed of the newest skills
│   └── api/
│       ├── auth/[...nextauth]/      NextAuth
│       ├── generate/                Model call
│       └── marketplace/             List, detail, publish, star
├── components/
│   ├── Nav.tsx                      Header with login and user menu
│   ├── CreateFlow.tsx               Form, result, download, publish
│   ├── SkillGrid.tsx                Server-rendered grid for tag/author pages
│   └── Providers.tsx                SessionProvider
└── lib/
    ├── ai.ts                        OpenRouter client, model ladder and system prompt
    ├── auth.ts                      NextAuth configuration
    ├── feed.ts                      RSS building and XML escaping
    ├── generate.ts                  Prompt building, model fallback, self-review pass
    ├── guardrails.ts                Output validation (frontmatter, real procedure)
    ├── normalize.ts                 Deterministic shape of the output
    ├── pdf.ts                       PDF text extraction, no dependency
    ├── preprocess.ts                Transcript and messy-notes clean-up
    ├── quality.ts                   Post-generation quality check
    ├── feedback.ts                  Feedback and rating model (pure)
    ├── feedback-db.ts               D1 access for feedback
    ├── marketplace.ts               Pure marketplace logic (tags, sorting, validation)
    ├── marketplace-db.ts            D1 access for the marketplace
    ├── messages.ts                  User-facing sentences shared by server and client
    ├── providers.ts                 LLM providers (Groq, OpenRouter) and their model ladders
    ├── fetch-with-timeout.ts        Client fetch with a deadline and a retry message
    ├── skill-download.ts            Download a skill's markdown, with the sign-in rule
    └── skill.ts                     Slug, fences, frontmatter
```

## Feedback and ratings

Right after a skill is generated the user is asked two things, both optional and
independent: a verdict (useful, partly, missed the point) and a 1 to 5 rating.
The verdict answers "was it useful?", the rating answers "how good was it?", and
keeping both means the numbers mean something on their own. No sign-in is
required and nothing identifying is stored, because the answer is about the
skill, not the person (migration `0008_feedback_rating.sql`).

The owner dashboard at `/stats` shows the verdict counters, the useful share, the
average rating and its distribution. Aggregation is pure (`summarizeFeedback`),
so it is testable without D1.

## Discovery

Beyond the searchable marketplace, skills are reachable by tag and by author,
which also gives each one a stable, indexable URL:

| Route | What it shows |
| --- | --- |
| `/tags` | Every tag used, with how many skills carry it |
| `/tags/[tag]` | Skills with one tag, ranked by trending |
| `/u/[owner]` | Everything one author has published |
| `/feed.xml` | RSS 2.0 feed of the newest published skills |

Tags are stored as a comma-separated string, so `tagClause` wraps both the
column and the term in commas to match a whole element (a plain `LIKE '%git%'`
would also match `github`). The tag index and the sitemap both aggregate that
column in JS, over a bounded number of rows.

## Registered users

Signing in with GitHub is the registration. The `users` table (migration
`0002_users.sql`) stores one row per login, with the first and last sign-in
dates; the landing page shows the count, read server-side so it is in the HTML.
Only the username is stored, no email and no token.

- The `signIn` callback in `lib/auth.ts` records the login. It never blocks the
  login: if D1 is unreachable the person still gets in.
- The migration backfills people who already used the site, from the authors and
  star-givers the marketplace already knows.
- The count is hidden (not shown as zero) when D1 is missing, so local
  development and a broken binding do not claim a wrong number.

## Obvious extensions

- **Streaming the generation**: pass `stream: true` to the model and use a
  `ReadableStream` in the route handler
- **Tag filtering in the search box**: accept `?tag=` on `/api/marketplace` and
  reuse `tagClause`, instead of only the dedicated tag pages
- **Following an author**: store `(follower, owner)` rows and let `/u/[owner]`
  show a follow button
- **Default templates**: a catalog of domains with pre-filled prompts

## License

MIT.
