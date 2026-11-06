# Skill Forge

Trasforma note sparse, documenti o una semplice idea in una skill completa e
dettagliata per agenti AI. Poi la scarichi come `.md` o la pubblichi direttamente
su GitHub.

## Cosa fa

| Modalità | Input | Output |
| --- | --- | --- |
| **A. Da materiale esistente** | Fino a 20 file (`.md`, `.txt`, `.json`, codice) oppure testo incollato | Una skill unica che fonde tutto il materiale, colma i buchi e conserva i dettagli tecnici |
| **B. Da zero** | Wizard a 6 campi (nome, dominio, obiettivo, tono, vincoli, esempi) | Skill completa con procedura numerata, esempi, errori comuni, checklist |

Ogni skill generata ha questa struttura:

```
frontmatter YAML (name, description)
Quando usarla / Quando NON usarla
Prerequisiti
Procedura
Regole e vincoli
Esempi (input + output atteso)
Errori comuni
Checklist finale
```

## Stack

- **Next.js 16** (App Router, TypeScript)
- **NextAuth 4** con provider GitHub (solo lettura del profilo)
- **OpenRouter** come gateway AI, OpenAI-compatibile, con fallback tra i modelli free
- **Tailwind CSS 3** con palette calda in OKLCH
- Deploy su **Cloudflare Workers** tramite l'adapter `@opennextjs/cloudflare`

## CLI

Il servizio si usa anche da terminale. La CLI vive in [`cli/`](cli/) ed è un
pacchetto Node a sé, senza dipendenze a runtime:

```bash
cd cli && npm install && npm run build && npm link
skill-forge login
cat note.md | skill-forge generate --quiet | skill-forge publish --tags docker
```

Genera, pubblica, cerca e scarica skill. Dettagli in [`cli/README.md`](cli/README.md).

## Avvio in locale

```bash
npm install
cp .env.example .env.local
# compila .env.local (vedi sotto)
npm run dev
```

Apri `http://localhost:3000`.

## Variabili d'ambiente

| Variabile | Dove trovarla |
| --- | --- |
| `GITHUB_ID` | [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) |
| `GITHUB_SECRET` | Stessa pagina, dopo aver creato l'app |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` in locale, l'URL del Worker in produzione |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys), chiave `sk-or-v1-...` |
| `OPENROUTER_MODELS` | Lista di modelli free in ordine di potenza (vedi `.env.example`) |

### Creare la GitHub OAuth App

1. Vai su [github.com/settings/developers](https://github.com/settings/developers)
2. **New OAuth App**
3. **Homepage URL**: `http://localhost:3000`
4. **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
5. Copia `Client ID` e `Client Secret` in `.env.local`

Per la produzione crea una **seconda** OAuth App (o aggiorna la callback) con:

```
https://<tuo-worker>.<sottodominio>.workers.dev/api/auth/callback/github
```

## Deploy su Cloudflare Workers

Il progetto usa l'[adapter OpenNext per Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/),
perché `next-auth` v4 richiede le API Node (`nodejs_compat`) che l'adapter
abilita nel Worker.

### Via Git (consigliato)

1. Pusha il progetto su GitHub
2. Cloudflare → **Workers & Pages** → **Create** → **Import a repository**
3. Scegli il repo. Cloudflare legge `wrangler.jsonc` da solo
4. In **Settings → Variables and Secrets** aggiungi tutte le variabili della
   tabella sopra, con `NEXTAUTH_URL` impostato all'URL finale
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

### Sviluppo nel runtime Workers

```bash
# .dev.vars con le stesse variabili di .env.local
npm run preview   # build + preview nel runtime workerd
```

## Deploy automatico

Ogni push su `main` compila il progetto e pubblica su Cloudflare Workers tramite
`.github/workflows/deploy.yml`. Setup una volta sola:

```bash
bash scripts/setup-deploy.sh
```

Lo script crea il repo GitHub, carica i secret del repository e stampa l'URL
previsto del Worker. Dettagli completi, inclusi i secret da impostare a mano, in
[docs/DEPLOY.md](docs/DEPLOY.md).

Flusso del workflow:

```
push su main  ->  job verify (npm ci + next build)  ->  job deploy (opennextjs-cloudflare deploy)
```

Se la build fallisce, il deploy non parte e la produzione resta all'ultima
versione funzionante. Dal tab Actions puoi lanciarlo a mano in modalità preview.

## Struttura

```
.github/workflows/deploy.yml   verifica e deploy su Cloudflare Workers
docs/DEPLOY.md                 guida completa al deploy automatico
scripts/setup-deploy.sh        onboarding: repo, worker, secret
scripts/check-env.mjs          controllo variabili prima del push
wrangler.jsonc                 configurazione del Worker
open-next.config.ts            configurazione dell'adapter OpenNext
src/
├── app/
│   ├── page.tsx                     Landing con le due modalità
│   ├── create/from-skills/page.tsx  Modalità A
│   ├── create/from-scratch/page.tsx Modalità B
│   ├── dashboard/page.tsx           Dove finiscono le skill
│   └── api/
│       ├── auth/[...nextauth]/      NextAuth
│       ├── generate/                Chiamata al modello
│       └── publish/                 Commit su GitHub
├── components/
│   ├── Nav.tsx                      Header con login e menu utente
│   ├── CreateFlow.tsx               Form, risultato, download, publish
│   └── Providers.tsx                SessionProvider
└── lib/
    ├── ai.ts                        Client OpenRouter, scala di modelli e system prompt
    ├── auth.ts                      Configurazione NextAuth
    ├── github.ts                    Wrapper API GitHub
    └── skill.ts                     Slug, fences, frontmatter
```

## Estensioni ovvie

- **Elenco skill in dashboard**: aggiungi `listFiles()` in `lib/github.ts` e una
  rotta `GET /api/skills` che legge `contents/skills` del repository
- **Streaming della generazione**: passa `stream: true` al modello e usa
  `ReadableStream` nel route handler
- **Versioning**: aggiorna le skill esistenti sfruttando lo SHA già gestito da
  `commitFile`
- **Template predefiniti**: catalogo di domini con prompt già compilati

## Licenza

Uso personale. Aggiungi una licenza se lo pubblichi.
