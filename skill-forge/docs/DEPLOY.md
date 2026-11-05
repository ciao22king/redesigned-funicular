# Deploy automatico su Cloudflare Workers

Il workflow `.github/workflows/deploy.yml` pubblica il sito su Cloudflare Workers
a ogni push su `main`. Nessun click, nessun token nel repository.

## Come funziona

```
push su main
   ↓
job "verify"   npm ci + next build            (fallisce qui se il codice è rotto)
   ↓
job "deploy"   opennextjs-cloudflare build && deploy
   ↓
Worker aggiornato
```

Se la build fallisce, il deploy **non parte**: il Worker in produzione resta
all'ultima versione funzionante.

Puoi anche lanciarlo a mano: **Actions → Deploy su Cloudflare Workers → Run
workflow**. Lì c'è una casella `production`: se la togli, ottieni un upload di
versione (preview) senza toccare la produzione.

## Perché l'adapter OpenNext e non vinext

Cloudflare consiglia vinext per i nuovi progetti Next.js. Qui però l'app usa
`next-auth` v4, che `vinext check` segnala come incompatibile perché si basa
sugli interni delle API route di Next. L'[adapter OpenNext](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
è la via indicata da Cloudflare per questi casi: supporta `next-auth` e le API
Node tramite il flag `nodejs_compat`, già attivo in `wrangler.jsonc`.

## Setup, una volta sola

### 1. Lo script

```bash
bash scripts/setup-deploy.sh
```

Ti chiede tre token e fa tutto: crea il repo GitHub, carica i secret, stampa
l'URL previsto del Worker. Ti serve `gh` autenticato (`gh auth login`).

### 2. Oppure a mano

**a.** Prendi il tuo `Account ID`:
```
Cloudflare dashboard → Workers & Pages → Account details → Account ID
```

**b.** Crea un API token con permesso **Workers Scripts: Edit**:
```
My Profile → API Tokens → Create Token → template "Edit Cloudflare Workers"
```

**c.** Aggiungi i secret al repository GitHub:
```
Settings → Secrets and variables → Actions → New repository secret
```

| Secret | Valore |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | il token del punto b |
| `CLOUDFLARE_ACCOUNT_ID` | l'ID del punto a |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<worker>.<sottodominio>.workers.dev` |
| `GH_OAUTH_ID` | Client ID della OAuth App GitHub |
| `GH_OAUTH_SECRET` | Client Secret della OAuth App GitHub |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_API_KEY` | chiave OpenRouter `sk-or-v1-...` |
| `OPENROUTER_MODELS` | lista di modelli free, dal più potente al meno |

**d.** Push su `main`.

## Variabili sul Worker

`wrangler.jsonc` non contiene variabili: quelle di runtime vanno impostate sul
Worker, non nel repository. Due modi:

- Dashboard: **Workers & Pages → il tuo Worker → Settings → Variables and
  Secrets**. Le variabili `NEXTAUTH_SECRET`, `GITHUB_SECRET` e
  `OPENROUTER_API_KEY` vanno marcate come **secret** (cifrate).
- CLI: `wrangler secret put NEXTAUTH_SECRET` per ognuna di quelle sensibili.

## Perché i secret si chiamano `GH_OAUTH_ID` e non `GITHUB_ID`

`GITHUB_*` è riservato da GitHub Actions e non può essere sovrascritto con un
secret. Il workflow li rimappa:

```yaml
GITHUB_ID: ${{ secrets.GH_OAUTH_ID }}
GITHUB_SECRET: ${{ secrets.GH_OAUTH_SECRET }}
```

## La OAuth App GitHub

Anche con il deploy automatico, la OAuth App va creata a mano una volta:

1. [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. **Homepage URL**: `https://<worker>.<sottodominio>.workers.dev`
3. **Authorization callback URL**: `https://<worker>.<sottodominio>.workers.dev/api/auth/callback/github`
4. Copia Client ID e Secret nei secret `GH_OAUTH_ID` / `GH_OAUTH_SECRET`

Se vuoi che funzioni anche in locale, crea una seconda OAuth App puntata a
`http://localhost:3000`.

## Alternativa: integrazione nativa Cloudflare

Cloudflare sa collegarsi a GitHub da solo, senza workflow:

**Workers & Pages → Create → Import a repository → scegli il repo**

Differenza pratica: con l'integrazione nativa il deploy parte da Cloudflare, e le
variabili si gestiscono nella dashboard del Worker. Con il workflow hai in più il
job `verify` prima del deploy e la possibilità di lanciare upload di versione
manuali. Scegli uno dei due, non entrambi, per non deployare due volte a ogni push.

## Se il deploy fallisce

| Sintomo | Causa |
| --- | --- |
| `Authentication error` | `CLOUDFLARE_API_TOKEN` mancante, scaduto, o senza permesso Workers Scripts Edit |
| `Account not found` | `CLOUDFLARE_ACCOUNT_ID` di un altro account |
| Build verde, pagina bianca | manca `NEXTAUTH_URL` corretto |
| Login GitHub 404 | callback URL della OAuth App non corrisponde al dominio del Worker |
| Login funziona, publish fallisce | scope della OAuth App senza `repo` |
| `NO_SECRET` nei log | `NEXTAUTH_SECRET` non impostata sul Worker (o non marcata come secret) |
