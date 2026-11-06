# Automatic deploy to Cloudflare Workers

The `.github/workflows/deploy.yml` workflow publishes the site to Cloudflare
Workers on every push to `main`. No clicks, no token in the repository.

## How it works

```
push to main
   ↓
"verify" job   npm ci + next build            (fails here if the code is broken)
   ↓
"deploy" job   opennextjs-cloudflare build && deploy
   ↓
Worker updated
```

If the build fails, the deploy **does not start**: the production Worker stays on
the last working version.

You can also run it by hand: **Actions → Deploy to Cloudflare Workers → Run
workflow**. There is a `production` checkbox: if you clear it, you get a version
upload (preview) without touching production.

## Why the OpenNext adapter and not vinext

Cloudflare recommends vinext for new Next.js projects. Here, though, the app uses
`next-auth` v4, which `vinext check` flags as incompatible because it relies on
the internals of Next's route APIs. The [OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
is the path Cloudflare points to for these cases: it supports `next-auth` and the
Node APIs through the `nodejs_compat` flag, already enabled in `wrangler.jsonc`.

## One-time setup

### 1. The script

```bash
bash scripts/setup-deploy.sh
```

It asks for three tokens and does everything: creates the GitHub repo, uploads
the secrets, prints the expected Worker URL. You need an authenticated `gh`
(`gh auth login`).

### 2. Or by hand

**a.** Get your `Account ID`:
```
Cloudflare dashboard → Workers & Pages → Account details → Account ID
```

**b.** Create an API token with the **Workers Scripts: Edit** permission:
```
My Profile → API Tokens → Create Token → template "Edit Cloudflare Workers"
```

**c.** Add the secrets to the GitHub repository:
```
Settings → Secrets and variables → Actions → New repository secret
```

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the token from step b |
| `CLOUDFLARE_ACCOUNT_ID` | the ID from step a |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<worker>.<subdomain>.workers.dev` |
| `GH_OAUTH_ID` | GitHub OAuth App Client ID |
| `GH_OAUTH_SECRET` | GitHub OAuth App Client Secret |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_API_KEY` | OpenRouter key `sk-or-v1-...` |
| `OPENROUTER_MODELS` | list of free models, from most to least powerful |

**d.** Push to `main`.

## Variables on the Worker

`wrangler.jsonc` holds no variables: runtime ones are set on the Worker, not in
the repository. Two ways:

- Dashboard: **Workers & Pages → your Worker → Settings → Variables and
  Secrets**. The `NEXTAUTH_SECRET`, `GITHUB_SECRET` and `OPENROUTER_API_KEY`
  variables must be marked as **secret** (encrypted).
- CLI: `wrangler secret put NEXTAUTH_SECRET` for each sensitive one.

## Why the secrets are called `GH_OAUTH_ID` and not `GITHUB_ID`

`GITHUB_*` is reserved by GitHub Actions and cannot be overridden with a secret.
The workflow remaps them:

```yaml
GITHUB_ID: ${{ secrets.GH_OAUTH_ID }}
GITHUB_SECRET: ${{ secrets.GH_OAUTH_SECRET }}
```

## The GitHub OAuth App

Even with the automatic deploy, the OAuth App must be created by hand once:

1. [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. **Homepage URL**: `https://<worker>.<subdomain>.workers.dev`
3. **Authorization callback URL**: `https://<worker>.<subdomain>.workers.dev/api/auth/callback/github`
4. Copy the Client ID and Secret into the `GH_OAUTH_ID` / `GH_OAUTH_SECRET` secrets

If you also want it to work locally, create a second OAuth App pointed at
`http://localhost:3000`.

## Alternative: native Cloudflare integration

Cloudflare can connect to GitHub on its own, without a workflow:

**Workers & Pages → Create → Import a repository → pick the repo**

Practical difference: with the native integration the deploy starts from
Cloudflare, and the variables are managed in the Worker dashboard. With the
workflow you additionally get the `verify` job before the deploy and the option
to run manual version uploads. Choose one of the two, not both, so you do not
deploy twice on every push.

## If the deploy fails

| Symptom | Cause |
| --- | --- |
| `Authentication error` | `CLOUDFLARE_API_TOKEN` missing, expired, or without the Workers Scripts Edit permission |
| `Account not found` | `CLOUDFLARE_ACCOUNT_ID` from another account |
| Green build, blank page | wrong or missing `NEXTAUTH_URL` |
| GitHub login 404 | the OAuth App callback URL does not match the Worker domain |
| Login works, publish fails | the OAuth App scope lacks `repo` |
| `NO_SECRET` in the logs | `NEXTAUTH_SECRET` not set on the Worker (or not marked as a secret) |
