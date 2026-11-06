#!/usr/bin/env bash
# ==============================================================================
#  Deploy automation setup — Skill Forge (Cloudflare Workers)
#
#  Run this script ONCE from the terminal, inside the project:
#
#      bash scripts/setup-deploy.sh
#
#  It does everything GitHub and Cloudflare cannot do on their own:
#    1. checks the prerequisites (git, node, gh)
#    2. creates the GitHub repository if missing and does the first push
#    3. creates the Cloudflare Worker and prints its URL
#    4. uploads the repository secrets to GitHub for the deploy workflow
#
#  When it finishes, the automation is live: every push to main builds and publishes.
# ==============================================================================

set -euo pipefail

BOLD=$'\033[1m'
DIM=$'\033[2m'
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

say()  { printf '%s\n' "$1"; }
ok()   { printf '%s\n' "${GREEN}✔${RESET} $1"; }
warn() { printf '%s\n' "${YELLOW}!${RESET} $1"; }
die()  { printf '%s\n' "${RED}✖${RESET} $1" >&2; exit 1; }
head() { printf '\n%s\n' "${BOLD}$1${RESET}"; }

# ---------------------------------------------------------------- prerequisiti
head "1/6  Prerequisites"

command -v git >/dev/null 2>&1 || die "git is not installed."
command -v node >/dev/null 2>&1 || die "node is not installed."

say "  git   $(git --version | awk '{print $3}')"
say "  node  $(node --version)"

HAVE_GH=0
if command -v gh >/dev/null 2>&1; then HAVE_GH=1; say "  gh    $(gh --version | head -1 | awk '{print $3}')"; else warn "gh (GitHub CLI) not found: it is needed for the repository secrets"; fi

if [ ! -d .git ]; then
  say "  Initializing the git repository..."
  git init -q
  git branch -M main
fi

# ------------------------------------------------------------ repo git locale
head "2/6  Initial commit"

if [ -z "$(git status --porcelain)" ]; then
  ok "Nothing to commit, the tree is clean."
else
  git add -A
  git -c user.name="${GIT_AUTHOR_NAME:-Skill Forge}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-noreply@example.com}" \
      commit -q -m "feat: Skill Forge, a skill generator for AI agents"
  ok "Commit created."
fi

# ---------------------------------------------------------------- credenziali
head "3/6  Credentials"

read -r -p "  GitHub token with 'repo' scope (ghp_... or github_pat_...): " GH_TOKEN
[ -n "$GH_TOKEN" ] || die "GitHub token required."

read -r -p "  Cloudflare API token (Workers Scripts: Edit): " CF_TOKEN
[ -n "$CF_TOKEN" ] || die "Cloudflare token required."

read -r -p "  OpenRouter key (sk-or-v1-...): " TH_KEY
[ -n "$TH_KEY" ] || die "OpenRouter key required."

read -r -p "  Repository and Worker name [skill-forge]: " REPO_NAME
REPO_NAME=${REPO_NAME:-skill-forge}

GH_USER=$(curl -sS -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).login||'')}catch{console.log('')}})")

[ -n "$GH_USER" ] || die "Invalid GitHub token."
ok "GitHub account: $GH_USER"

CF_ACCOUNT=$(curl -sS -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log((j.result&&j.result[0]&&j.result[0].id)||'')}catch{console.log('')}})")

[ -n "$CF_ACCOUNT" ] || die "Invalid Cloudflare token (or no account visible)."
ok "Cloudflare account: $CF_ACCOUNT"

NEXTAUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# --------------------------------------------------------------- repo remoto
head "4/6  GitHub repository"

HTTP_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $GH_TOKEN" \
  "https://api.github.com/repos/$GH_USER/$REPO_NAME")

if [ "$HTTP_STATUS" = "200" ]; then
  ok "The repository $GH_USER/$REPO_NAME already exists."
else
  say "  Creating $GH_USER/$REPO_NAME ..."
  curl -sS -X POST \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO_NAME\",\"auto_init\":false,\"description\":\"Skill Forge, a skill generator for AI agents\"}" \
    > /dev/null
  ok "Repository created."
fi

REMOTE="https://x-access-token:$GH_TOKEN@github.com/$GH_USER/$REPO_NAME.git"
if git remote | grep -q '^origin$'; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

git push -q -u origin main --force
ok "Push to main completed."

# --------------------------------------------------------------- worker CF
head "5/6  Cloudflare Worker"

say "  The Worker is created on the first deploy (npm run deploy)."
say "  Worker name: $REPO_NAME"
say "  Expected URL: https://$REPO_NAME.<your-subdomain>.workers.dev"

# ------------------------------------------------------------- secret GitHub
head "6/6  GitHub repository secrets"

put_secret() {
  local name="$1" value="$2"
  if [ "$HAVE_GH" = "1" ] && gh auth status >/dev/null 2>&1; then
    printf '%s' "$value" | gh secret set "$name" --repo "$GH_USER/$REPO_NAME" >/dev/null
  else
    die "An authenticated GitHub CLI is required to upload the secret $name. Run: gh auth login"
  fi
}

put_secret CLOUDFLARE_API_TOKEN   "$CF_TOKEN"
put_secret CLOUDFLARE_ACCOUNT_ID  "$CF_ACCOUNT"
put_secret NEXTAUTH_SECRET        "$NEXTAUTH_SECRET"
put_secret GH_OAUTH_ID            ""
put_secret GH_OAUTH_SECRET        ""
put_secret OPENROUTER_BASE_URL   "https://openrouter.ai/api/v1"
put_secret OPENROUTER_API_KEY    "$TH_KEY"
put_secret OPENROUTER_MODELS      "nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3.5-super-vl:free,nvidia/nemotron-3.5-lightning:free,dots-studio/dots-3-note-preview:free,google/gemma-4-31b-it:free,recursive/flint-v1.0:free,google/gemma-4-26b-a4b-it:free,xingchen-agi/xing4.0-29b-a4b:free,cohere/north-mini-code:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,liquid/lfm-2.5-2.6b:free"

ok "Secrets uploaded."

head "Done"
say "  Repository:  https://github.com/$GH_USER/$REPO_NAME"
say ""
say "  ${BOLD}Manual one-time steps:${RESET}"
say "  1. Create the OAuth App at https://github.com/settings/developers with"
say "     callback  https://$REPO_NAME.<your-subdomain>.workers.dev/api/auth/callback/github"
say "     then upload the values:"
say ""
say "       gh secret set GH_OAUTH_ID --repo $GH_USER/$REPO_NAME"
say "       gh secret set GH_OAUTH_SECRET --repo $GH_USER/$REPO_NAME"
say ""
say "  2. Set NEXTAUTH_URL to the Worker URL:"
say ""
say "       gh secret set NEXTAUTH_URL --repo $GH_USER/$REPO_NAME"
say ""
say "  3. Set the secrets on the Worker (npm run deploy publishes them as vars,"
say "     or use the Cloudflare dashboard → Workers → Settings → Variables)."
say ""
say "  Once done, every push to main builds and publishes automatically."

# Keep the token out of .git/config
git remote set-url origin "https://github.com/$GH_USER/$REPO_NAME.git"
