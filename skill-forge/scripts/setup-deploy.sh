#!/usr/bin/env bash
# ==============================================================================
#  Setup automazione deploy — Skill Forge (Cloudflare Workers)
#
#  Esegui questo script UNA VOLTA dal terminale, dentro il progetto:
#
#      bash scripts/setup-deploy.sh
#
#  Fa tutto quello che GitHub e Cloudflare non possono fare da soli:
#    1. verifica i prerequisiti (git, node, gh)
#    2. crea il repository GitHub se non esiste e fa il primo push
#    3. crea il Worker Cloudflare e stampa il suo URL
#    4. carica i secret del repository su GitHub per il workflow di deploy
#
#  Alla fine l'automazione è attiva: ogni push su main compila e pubblica.
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
head "1/6  Prerequisiti"

command -v git >/dev/null 2>&1 || die "git non installato."
command -v node >/dev/null 2>&1 || die "node non installato."

say "  git   $(git --version | awk '{print $3}')"
say "  node  $(node --version)"

HAVE_GH=0
if command -v gh >/dev/null 2>&1; then HAVE_GH=1; say "  gh    $(gh --version | head -1 | awk '{print $3}')"; else warn "gh (GitHub CLI) non trovato: serve per i secret del repository"; fi

if [ ! -d .git ]; then
  say "  Inizializzo il repository git..."
  git init -q
  git branch -M main
fi

# ------------------------------------------------------------ repo git locale
head "2/6  Commit iniziale"

if [ -z "$(git status --porcelain)" ]; then
  ok "Nessuna modifica da committare, l'albero è pulito."
else
  git add -A
  git -c user.name="${GIT_AUTHOR_NAME:-Skill Forge}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-noreply@example.com}" \
      commit -q -m "feat: Skill Forge, generatore di skill per agenti AI"
  ok "Commit creato."
fi

# ---------------------------------------------------------------- credenziali
head "3/6  Credenziali"

read -r -p "  Token GitHub con scope 'repo' (ghp_... o github_pat_...): " GH_TOKEN
[ -n "$GH_TOKEN" ] || die "Token GitHub obbligatorio."

read -r -p "  Cloudflare API token (Workers Scripts: Edit): " CF_TOKEN
[ -n "$CF_TOKEN" ] || die "Token Cloudflare obbligatorio."

read -r -p "  Token Harbor API key (thk_live_...): " TH_KEY
[ -n "$TH_KEY" ] || die "Chiave Token Harbor obbligatoria."

read -r -p "  Nome del repository e del Worker [skill-forge]: " REPO_NAME
REPO_NAME=${REPO_NAME:-skill-forge}

GH_USER=$(curl -sS -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).login||'')}catch{console.log('')}})")

[ -n "$GH_USER" ] || die "Token GitHub non valido."
ok "Account GitHub: $GH_USER"

CF_ACCOUNT=$(curl -sS -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log((j.result&&j.result[0]&&j.result[0].id)||'')}catch{console.log('')}})")

[ -n "$CF_ACCOUNT" ] || die "Token Cloudflare non valido (o nessun account visibile)."
ok "Account Cloudflare: $CF_ACCOUNT"

NEXTAUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# --------------------------------------------------------------- repo remoto
head "4/6  Repository GitHub"

HTTP_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $GH_TOKEN" \
  "https://api.github.com/repos/$GH_USER/$REPO_NAME")

if [ "$HTTP_STATUS" = "200" ]; then
  ok "Il repository $GH_USER/$REPO_NAME esiste già."
else
  say "  Creo $GH_USER/$REPO_NAME ..."
  curl -sS -X POST \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO_NAME\",\"auto_init\":false,\"description\":\"Skill Forge, generatore di skill per agenti AI\"}" \
    > /dev/null
  ok "Repository creato."
fi

REMOTE="https://x-access-token:$GH_TOKEN@github.com/$GH_USER/$REPO_NAME.git"
if git remote | grep -q '^origin$'; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

git push -q -u origin main --force
ok "Push su main completato."

# --------------------------------------------------------------- worker CF
head "5/6  Worker Cloudflare"

say "  Il Worker viene creato al primo deploy (npm run deploy)."
say "  Nome Worker: $REPO_NAME"
say "  URL previsto: https://$REPO_NAME.<tuo-sottodominio>.workers.dev"

# ------------------------------------------------------------- secret GitHub
head "6/6  Secret del repository GitHub"

put_secret() {
  local name="$1" value="$2"
  if [ "$HAVE_GH" = "1" ] && gh auth status >/dev/null 2>&1; then
    printf '%s' "$value" | gh secret set "$name" --repo "$GH_USER/$REPO_NAME" >/dev/null
  else
    die "Serve la GitHub CLI autenticata per caricare il secret $name. Esegui: gh auth login"
  fi
}

put_secret CLOUDFLARE_API_TOKEN   "$CF_TOKEN"
put_secret CLOUDFLARE_ACCOUNT_ID  "$CF_ACCOUNT"
put_secret NEXTAUTH_SECRET        "$NEXTAUTH_SECRET"
put_secret GH_OAUTH_ID            ""
put_secret GH_OAUTH_SECRET        ""
put_secret TOKENHARBOR_BASE_URL   "https://tokenharbor.ai/v1"
put_secret TOKENHARBOR_API_KEY    "$TH_KEY"
put_secret TOKENHARBOR_MODEL      "deepseek-v4.1-flash:free"

ok "Secret caricati."

head "Fatto"
say "  Repository:  https://github.com/$GH_USER/$REPO_NAME"
say ""
say "  ${BOLD}Passaggi manuali, una volta sola:${RESET}"
say "  1. Crea l'OAuth App su https://github.com/settings/developers con"
say "     callback  https://$REPO_NAME.<tuo-sottodominio>.workers.dev/api/auth/callback/github"
say "     poi carica i valori:"
say ""
say "       gh secret set GH_OAUTH_ID --repo $GH_USER/$REPO_NAME"
say "       gh secret set GH_OAUTH_SECRET --repo $GH_USER/$REPO_NAME"
say ""
say "  2. Imposta NEXTAUTH_URL all'URL del Worker:"
say ""
say "       gh secret set NEXTAUTH_URL --repo $GH_USER/$REPO_NAME"
say ""
say "  3. Imposta i secret sul Worker (npm run deploy li pubblica come vars,"
say "     oppure usa la dashboard Cloudflare → Workers → Settings → Variables)."
say ""
say "  Fatto questo, ogni push su main compila e pubblica automaticamente."

# Evita che il token resti in .git/config
git remote set-url origin "https://github.com/$GH_USER/$REPO_NAME.git"
