# Skill Forge

Turn scattered notes, documents or a simple idea into a complete, detailed skill
for AI agents. Then download it as `.md` or publish it straight to the
marketplace.

## What it does

| Mode | Input | Output |
| --- | --- | --- |
| **A. From existing material** | Up to 20 files (`.md`, `.txt`, `.json`, code) or pasted text | One skill that merges all the material, fills the gaps and keeps the technical details |
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
npm install -g @ciao22/skill-forge-cli
skill-forge login
cat note.md | skill-forge generate --quiet | skill-forge publish --tags docker
```

Generate, publish, search and download skills. Details in
[`cli/README.md`](cli/README.md).

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
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys), key `sk-or-v1-...` |
| `OPENROUTER_MODELS` | List of free models in order of power (see `.env.example`) |

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
│   └── api/
│       ├── auth/[...nextauth]/      NextAuth
│       ├── generate/                Model call
│       └── publish/                 Commit to the marketplace
├── components/
│   ├── Nav.tsx                      Header with login and user menu
│   ├── CreateFlow.tsx               Form, result, download, publish
│   └── Providers.tsx                SessionProvider
└── lib/
    ├── ai.ts                        OpenRouter client, model ladder and system prompt
    ├── auth.ts                      NextAuth configuration
    ├── github-token.ts              GitHub token handling
    └── skill.ts                     Slug, fences, frontmatter
```

## Obvious extensions

- **Skill list in the dashboard**: add `listFiles()` in `lib/github-token.ts` and
  a `GET /api/skills` route that reads the repository's `contents/skills`
- **Streaming the generation**: pass `stream: true` to the model and use a
  `ReadableStream` in the route handler
- **Versioning**: update existing skills using the SHA already handled by
  `commitFile`
- **Default templates**: a catalog of domains with pre-filled prompts

## License

MIT.
