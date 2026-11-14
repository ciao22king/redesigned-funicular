# Deploy to Cloudflare Workers

The site is built and published by **Cloudflare Workers Builds**: Cloudflare
connects to the GitHub repository, runs the build on every push and deploys the
Worker. There is no deploy step in GitHub Actions, and no Cloudflare token in
the repository.

GitHub Actions keeps a **CI** workflow (`.github/workflows/ci.yml`) that only
runs the tests and the build, so a broken commit is visible before Cloudflare
deploys it. It does **not** deploy: if both it and Workers Builds deployed, every
push would publish twice.

## How it works

```
push to main
   |
Workers Builds (Cloudflare)              CI (GitHub Actions, independent)
   build command  npm run build             npm test
   deploy command npm run deploy            npm run build
   |
Worker updated
```

If the build fails, the Worker stays on the last working version.

## One-time setup

### 1. Connect the repository to the Worker

The Worker `skill-forge` already exists, so connect it to the repository instead
of creating a second one:

**Workers & Pages -> skill-forge -> Settings -> Builds -> Connect to Git -> pick
the repo**, and set the production branch to `main`.

(If you were starting from nothing, it would be **Workers & Pages -> Create ->
Import a repository**.)

### 2. Build settings

The app is in the `skill-forge/` subdirectory, not at the repository root, so the
**Root directory** must be set. Without it the build runs at the root, finds no
`package.json` and fails.

| Setting | Value |
| --- | --- |
| **Root directory** | `skill-forge` |
| **Build command** | `npm run build` |
| **Deploy command** | `npm run deploy` |

`npm run deploy` is `opennextjs-cloudflare build && opennextjs-cloudflare deploy`.
The build command is not redundant: `opennextjs-cloudflare deploy` publishes the
bundle that `opennextjs-cloudflare build` produced, and Workers Builds runs the
deploy command in a separate step after the build command.

### 3. Variables and secrets

Set these in **Workers & Pages -> your Worker -> Settings -> Variables and
Secrets** (and in the build variables, so the build can read them too). Mark
`NEXTAUTH_SECRET`, `GITHUB_SECRET` and `OPENROUTER_API_KEY` as **secret**
(encrypted).

| Variable | Value |
| --- | --- |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://skillforge.cc.cd` |
| `GITHUB_ID` | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_API_KEY` | OpenRouter key `sk-or-v1-...` |
| `OPENROUTER_MODELS` | list of free models, from most to least powerful |

The non-secret values already live in `wrangler.jsonc` under `vars` (`GITHUB_ID`,
`UNLIMITED_LOGINS`, `ADMIN_LOGINS`, `FOUNDING_TESTERS`), and `keep_vars` is on so
a CLI deploy does not clear what you set from the dashboard.

### 4. Push to `main`.

## The GitHub OAuth App

The OAuth App must be created by hand once:

1. [github.com/settings/developers](https://github.com/settings/developers) -> **New OAuth App**
2. **Homepage URL**: `https://skillforge.cc.cd`
3. **Authorization callback URL**: `https://skillforge.cc.cd/api/auth/callback/github`
4. Copy the Client ID and Secret into the `GITHUB_ID` / `GITHUB_SECRET` variables

If you also want it to work locally, create a second OAuth App pointed at
`http://localhost:3000`.

## Why the OpenNext adapter and not vinext

Cloudflare recommends vinext for new Next.js projects. Here, though, the app uses
`next-auth` v4, which `vinext check` flags as incompatible because it relies on
the internals of Next's route APIs. The [OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
is the path Cloudflare points to for these cases: it supports `next-auth` and the
Node APIs through the `nodejs_compat` flag, already enabled in `wrangler.jsonc`.

## Deploy by hand

When you would rather not wait for a push:

```bash
npm i -g wrangler
wrangler login
wrangler secret put NEXTAUTH_SECRET   # once, for each secret
npm run deploy
```

## If the deploy fails

| Symptom | Cause |
| --- | --- |
| `no such file or directory, open 'package.json'` | **Root directory** not set to `skill-forge` |
| `Authentication error` | the Worker's API token is missing, expired, or without the Workers Scripts Edit permission |
| `Account not found` | the account ID does not match the Worker |
| Green build, blank page | wrong or missing `NEXTAUTH_URL` |
| GitHub login 404 | the OAuth App callback URL does not match the Worker domain |
| Login works, publish fails | the OAuth App scope lacks `repo` |
| `NO_SECRET` in the logs | `NEXTAUTH_SECRET` not set on the Worker (or not marked as a secret) |
