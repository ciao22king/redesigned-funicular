# Project memory

Two unrelated things live in this repo:
- `LibonOS/` — the Linux-kernel fork + LibonUI desktop shell (below).
- `tiktok-forgeski/` — a standalone Python video renderer that builds a
  vertical promo for `forgeski.netlify.app`. See `2026-11-04.md`. It shares no
  code or conventions with LibonOS.

## Repo layout trap

`/workspace/project` is a single git repo containing both projects. It had **no
commits** until 2026-11-04. Run `git rev-parse --show-toplevel` before assuming
where you are; the kernel tree's `.gitignore` does not cover siblings.

## Container, every session

These are **not** preinstalled and must be reinstalled each session — earlier
notes claiming otherwise were wrong for this image:
`python3 -m pip install numpy pillow fonttools`, `sudo apt-get install -y ffmpeg`.
`bc` is absent; do arithmetic in `python3`.

## Cloudflare agent setup (done 2026-11-05)

Ran the official setup at `https://developers.cloudflare.com/agent-setup/prompt.md`.
OpenHands is not one of its named agents, so the "other agents" path applies.

- **Skills**: `npx -y skills add cloudflare/skills --skill '*' --yes --global`
  installs them to `~/.agents/skills/` and symlinks them for the agent
  (`~/.openhands/skills/`). The CLI auto-detects this agent as "OpenHands".
  Verify with `npx -y skills list -g`. **These do NOT survive a new container**:
  re-run the command each session (2026-11-07: re-run, 22 skills, was 19).
  The Cloudflare MCP (`mcp_config.cloudflare` -> `https://mcp.cloudflare.com/mcp`,
  oauth2) is in `/home/openhands/.openhands/settings.json` under `mcp_config`
  (NOT `mcpServers`) and did persist.
- **MCP**: the local agent-server (pid 1, `--port 60000`) owns MCP config and is
  the canonical store — docs say there is *no* per-project MCP config file, so do
  not hand-edit one. Register servers over its REST API:
  `POST /api/settings/mcp/<name>` with
  `{"transport":"streamable-http","url":...,"auth":{"strategy":"oauth2"},"enabled":true}`
  → persists into `agent_settings.mcp_config`. Also `PATCH`/`DELETE /api/settings/mcp/<name>`,
  `GET /api/settings`, and `POST /api/mcp/test` (validate a server without saving).
- **Auth to that API**: header `X-Session-API-Key: <SESSION_API_KEY>`. The key
  lives in the server process env (`/proc/1/environ`), not the shell. Read it with
  `tr '\0' '\n' < /proc/1/environ | sed -n 's/^SESSION_API_KEY=//p'`. Never print it.
- `https://mcp.cloudflare.com/mcp` returns **401 without OAuth**. OAuth *can* be
  completed headlessly if the user copies the redirect URL out of their browser:
  `POST /api/mcp/oauth/start` (spec must include `auth.strategy=oauth2`; `timeout`
  ≤ 120 s) → `authorization_url` + `job_id`; user authorizes, lands on a
  `localhost:<port>/callback?...` error page (that localhost is the *container's*),
  copies the full URL; `POST /api/mcp/oauth/callback/<job_id>` with
  `{"callback_url": "..."}` → `{"status":"succeeded","tools":[...],"oauth_state":{...}}`.
  Then `PATCH /api/settings/mcp/<name>` with `{"auth":{"strategy":"oauth2","state":<oauth_state>}}`.
  The `/callback` endpoint only works while the job is alive (≤120 s); on a dead job
  it 500s with "All connection attempts failed".
- **Secrets are encrypted at rest.** `GET /api/settings` redacts (`"**********"`,
  len 10) unless you send header `X-Expose-Secrets: plaintext` (or `encrypted`).
  Never persist a state you read back from a default GET — you would save the
  redaction placeholder. Persist the `oauth_state` from the `/api/mcp/oauth/callback`
  or `/api/mcp/test` **response** instead; that is the authoritative fresh state.
- `/api/mcp/test` timeouts here were **transient** — the same config that timed out
  at 30 s and 120 s later returned `ok:true` with tools `docs, search, execute,
  whoami`. Retry before assuming the config is broken. It returns HTTP 200 with
  `ok:false` for connection failures.
- Cloudflare's WAF (error 1010) **403s `urllib`'s default User-Agent**; use `curl`
  or set a browser UA when probing `mcp.cloudflare.com` by hand.
- **Plugin format alternative** (docs.openhands.dev/overview/plugins,
  `/overview/agent-plugins`): plugins load from `~/.agents/plugins` or
  `~/.openhands/plugins`; MCP goes in `.mcp.json` (OpenHands format) or a root
  `mcp.json` (Agent Plugins format, `stdio`/`streamable-http` only).

---

# LibonOS — project memory

`/workspace/project/LibonOS` is a fork of the **Linux kernel tree** (remote
`ciao22king/LibonOS`, branch **`master`** — not `main`; shallow clone, one
grafted commit `Linux 7.4-rc1`). On top of it sits **LibonUI**, the desktop shell
of LibonOS, in `libonui/` — a Rust workspace, **MIT-licensed**, so the kernel's
`Documentation/process/coding-assistants.rst` rules (GPL-2.0-only, never add
`Signed-off-by:`) do **not** govern it. `Co-authored-by:` is fine there; still
never add `Signed-off-by:`.

> The memory in this directory was pre-seeded with notes from a *different*
> project (ShutChat, an Android app). They are archived as
> `2026-11-03-preseeded-shutchat-memory.md`. Do not trust them here.

## The app (`libonui/`)
Three crates, split so the rules are testable with no UI toolkit:
- `libonui-core` — no egui. Design tokens (`tokens.rs`), version + update policy
  (`version.rs`), bundled update feeds (`channels.rs`), local account / PBKDF2
  (`accounts.rs`), window manager (`wm.rs`), the three package backends
  (`packages/{libon,apt,pacman,appimage}.rs`), the app manifest (`system.rs`).
- `libonui-app` — the egui/eframe shell. `screens/` (setup, login, desktop,
  store, settings, terminal, files, text_editor), `components.rs`, `icons.rs`
  (hand-drawn vector glyphs), `theme.rs`, `shots.rs` (headless screenshots).
- `libonui-cli` — binary named **`libon`**.

### Product invariants (do not break)
- **First boot = setup** (6 steps: Welcome, Name, Password, PackageManager,
  Privacy, Finish); **later boots = login**. The password is only ever a salted
  PBKDF2-HMAC-SHA256 digest.
- **Two update kinds, and the split is the point.** In-place (minor/patch, e.g.
  1.0.0→1.1.0) is available from Settings *and* `libon update`. A **full system
  upgrade** (major bump, 1.0.0→2.0.0) is offered **only from Settings**, behind a
  confirmation; `libon upgrade` explains the rule and refuses to run it. The
  policy lives in `libonui-core::version` so UI and CLI cannot drift.
- **`libon` is preinstalled and the default backend; APT and pacman may be
  absent.** The Store refuses and raises one `NotifyKind::Error` notice when the
  chosen backend's binary is missing — never fake progress.
- Colour carries meaning (action/focus/status), never decoration: deep
  violet-black canvas plus one violet→cyan accent pair, in `tokens.rs`.
- The UI is **Italian**.
- `libonui/artifacts/` (19 PNGs + `index.html`) is committed on purpose: they are
  the real renderer's output, not mock-ups.

### Layout traps
- `libonui/.gitignore` holds only `/target` (1.9 GB — never commit it). The
  parent kernel `.gitignore` does not cover `libonui/`, so it needs its own.
- `libonui/docs/` was an empty, untracked directory; the README is
  `libonui/README.md`.

## Build & verify
- `export PATH="$HOME/.cargo/bin:$PATH"` first — cargo is not on the default PATH.
- `rustfmt` and `clippy` are **not installed by default**:
  `rustup component add rustfmt clippy` once per container.
- `cargo test --workspace` → **56 tests** (47 core + 6 app + 3 cli).
- `cargo clippy --workspace --all-targets` → **0 warnings** (was 22). Keep it there.
- `rustc` is 1.99.1 but `.clippy.toml` pins `msrv = "1.85.0"`; if `Cargo.toml`'s
  `rust-version` disagrees, clippy emits its own warning, so both are 1.85.
- `cargo build --release -p libonui-app -p libonui-cli` (~1m20s) →
  `target/release/libonui`, `target/release/libon`.

## Screenshots (the visual check)
- Headless render, no display needed:
  `xvfb-run -a -s "-screen 0 1440x900x24" cargo run -p libonui-app -- --shots artifacts`
- `shots.rs` owns the shot list (`script()`), per-shot setup (`configure`) and
  `write_index()`; PNGs and `index.html` both come from that one list, so adding
  a shot is a single edit. When adding a field to `ShotKind::Desktop`, every
  literal in `script()` must gain it.
- To eyeball a PNG with no viewer, decode it in `python3` (zlib + PNG unfilter)
  and print a luminance ASCII map — good for confirming a panel really rendered
  where the code says it did.
- Serve it: `python3 -m http.server 12000 --bind 0.0.0.0` in `artifacts/`, read
  via the `work-1-…` host from REPO_CONTEXT.

## `npx impeccable`
- `impeccable` (npm, v4.8.0) installs design skills and detects UI anti-patterns.
- `npx --yes impeccable@4.8.0 install` is **interactive** and sits on a prompt
  until killed — run it backgrounded with output to a log. Here it found the
  skills already installed globally at `~/.claude/skills/impeccable` (plus
  `~/.claude/agents/impeccable-*.md`) and reported "up to date".
- `impeccable detect <target>` **hangs and exits silently** in this container
  (zombie `<defunct>` processes, nothing on stdout/stderr), even with `--json`;
  it emitted `[]` exactly once. Do not block on it.

## Traps (environment)
- **`bc` is not installed** — do arithmetic in `python3`.
- `gh` is at `/usr/bin/gh` and works with `GH_TOKEN=$GITHUB_TOKEN`.
- A credential baked into a git remote URL goes stale and `git push` then hangs
  on a password prompt. Check `$GITHUB_TOKEN` against `https://api.github.com/user`
  first; if good, strip the credential (`git remote set-url origin
  https://github.com/<owner>/<repo>.git`) and push with
  `https://x-access-token:$GITHUB_TOKEN@github.com/...`. Never print a token.
- **`git reset --hard` wipes uncommitted work.** Commit first.
- Shallow clone: no tags, no history to blame or bisect.

## Skill Forge → Cloudflare Workers (2026-11-05)

`skill-forge.zip` (app Next.js 16 + next-auth v4 + OpenAI + GitHub API, nata per
Netlify) è stata adattata a Cloudflare Workers e pushatа su branch
`cloudflare-workers` di `redesigned-funicular` (PR #1).

- **Adapter: OpenNext, non vinext.** `vinext check` dà 83% e segnala `next-auth`
  v4 come incompatibile ("relies on Next.js API route internals"). La guida
  Cloudflare indica OpenNext per i compatibility gap: `nodejs_compat` copre
  next-auth e le API Node. Config: `wrangler.jsonc` (`main: .open-next/worker.js`,
  binding `ASSETS`) + `open-next.config.ts`.
- Build verificata: `npm run build` → `npx opennextjs-cloudflare build` →
  `wrangler deploy --dry-run` = 6.7 MB (limite paid 10 MB). In locale
  `wrangler dev` serve le pagine; le route API leggono le variabili **solo** da
  `.dev.vars` (le env della shell NON arrivano al Worker → errore `NO_SECRET`).
- **Deploy riuscito** con `npx wrangler deploy --temporary`: account temporaneo
  claimable entro 60 min, URL `https://skill-forge.cloudy-coneflower.workers.dev`.
  Utile quando non c'è un token con scope Workers.
- **Deploy riuscito anche sull'account reale** con il token `cfat_...` fornito
  dall'utente: `https://skill-forge.ciao22king.workers.dev` (sottodominio
  `ciao22king`, account id `69e8820212c184a7fb5ed2f0b913d551`). Da quel momento
  esiste lo script per ripetere: `CLOUDFLARE_API_TOKEN=<cfat_> CLOUDFLARE_ACCOUNT_ID=<id> npx wrangler deploy`.
- **Il livello AI è passato a OpenRouter** (prima Token Harbor). Chiavi OpenRouter
  = `sk-or-v1-...`; il token `cfat_...` che l'utente credeva OpenRouter è in
  realtà un **Cloudflare API token** (verifica `accounts/<id>/tokens/verify` → 200).
  `OPENROUTER_MODELS` = lista di modelli `:free` dal più potente al meno; la route
  `/api/generate` prova un modello alla volta e passa al successivo su errore o
  risposta vuota. Elenco free ottenibile da `GET https://openrouter.ai/api/v1/models`.
- **Limite credenziali**: il secret `Cloudflare` dell'ambiente NON è un API token
  valido (formato `CLOUDFLARE_API_TOKEN <53 char>` con prefisso `cfut_`, ogni
  interpretazione → 401); l'MCP OAuth Cloudflare è read-only (nessuno scope
  workers). `GITHUB_TOKEN` è una **GitHub App** (`ghu_`): può pushare su repo
  esistenti ma **non creare** repository (`Resource not accessible by integration`).
  Per questo il codice è andato su un branch del repo esistente, non su un repo nuovo.

## Dominio eu.org → Cloudflare (2026-11-05)

Obiettivo: dare a Skill Forge un dominio completo gratis con DNS gestito da
Cloudflare. Scelto **eu.org** (l'unico gratis con DNS completo e reputazione
decente; Freenom è morto, SSL scaduto; is-a.dev e js.org sono solo CNAME e non
si possono mettere come zona Cloudflare).

- Zona creata via API: `skillforge.eu.org`, zone id `718aec9161dfa10022c6f3b8bd16ec28`,
  account `Ciao22king@gmail.com's Account` (`69e8820212c184a7fb5ed2f0b913d551`).
- Nameserver da dare a eu.org: `achiel.ns.cloudflare.com` / `chloe.ns.cloudflare.com`.
- Richiesta eu.org inviata: id **`20261105162722-arf-65042`**; i controlli
  automatici SOA/NS sono passati ("No error, storing for validation"). Ora è in
  approvazione **manuale**, da giorni a settimane.
- Zona ancora `pending` e non delegata pubblicamente: normale finché eu.org non
  pubblica la delega NS. Non ricreare la zona né cambiare i nameserver.
- Quando la zona è `Active`: aggiungere `skillforge.eu.org` come **custom domain**
  del Worker, aggiornare `NEXTAUTH_URL` e la callback OAuth GitHub a
  `https://skillforge.eu.org/api/auth/callback/github`.

## Secret del Worker (stato)

Impostati: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OPENROUTER_BASE_URL`,
`OPENROUTER_MODELS`. `GITHUB_ID` è pubblico e sta in `wrangler.jsonc` (`vars`,
con `keep_vars: true`). **Mancano** `GITHUB_SECRET` e `OPENROUTER_API_KEY`.
Trap: Cloudflare, quando aggiungi una var dalla dashboard, chiede di scriverla
anche in `wrangler.jsonc`; metterci un secret vero lo pubblicherebbe su git.

## Trappola: SDK OpenAI su Workers → "Connection error"

`openai` (v4.x) dentro un Worker Cloudflare con `nodejs_compat` rileva il runtime
**node** e usa `node-fetch` + `agentkeepalive`: gli `http.Agent` non esistono su
workerd, quindi **ogni** chiamata fallisce con "Connection error" (non 401, non
timeout: proprio connection error). Sintomo tipico: la catena di fallback sui
modelli free si esaurisce con "Connection error." su tutti.
Fix: **non usare l'SDK**; chiamare la REST API con la `fetch` nativa. Verifica:
con chiave finta si deve ottenere HTTP 401, non connection error. Nel dubbio
controllare il bundle: `grep -c "node-fetch\|agentkeepalive" .open-next/server-functions/default/handler.mjs`
deve dare 0.

## Font self-hosted (verifica) + pagine legali

`next/font/google` (Fraunces + Public_Sans in `src/app/layout.tsx`) scarica i
font a **build time** e li serve dai nostri asset: nel build ci sono 6 `.woff2`
e **zero** riferimenti a `fonts.googleapis.com`/`gstatic`. Non serve cambiare
nulla: l'HTML live della home ha 0 occorrenze di googleapis.
Pagine legali aggiunte: `/termini`, `/privacy`, `/cookie`, con `LegalShell` +
`Footer` (componenti condivisi). Nessun banner cookie: l'unico cookie è il
sessione tecnico di next-auth (`next-auth.session-token`), quindi il consenso
non è richiesto. Stili in `.legal` dentro `globals.css`.

## Pagine legali (finali, 2026-11-05)

Skill Forge ha **solo tre** pagine legali, quelle che servono a un singolo
sviluppatore: `/termini`, `/privacy`, `/cookie`. Rimosse note-legali,
accessibilita, sicurezza, contatti (non obbligatorie per un progetto personale).
Componenti: `LegalShell` + `Footer` (footer con i tre link e "Progetto
personale"). Dati in `src/lib/legal.ts`, ridotto a `name` + `email`.
Nessun banner cookie: unico cookie è il sessione tecnico di next-auth.
Infrastruttura resta: `icon.svg`, `robots.ts`, `sitemap.ts` (4 URL),
`manifest.ts`, `public/.well-known/security.txt`, metadata in `layout.tsx`.

## Skill Forge — sicurezza (audit 2026-11-05)

Skill `security-audit` di Cloudflare installata in `.agents/skills/` (CLI:
`npx skills add <repo> --skill <nome> -y`; senza `-y` resta su un prompt).
Output dell'audit in `~/security-audit-skill/<repo>/run-<N>/` (fuori dal repo).
I validatori della skill sono severi: findings ordinati per fingerprint
lessicografico, `needs_validation` senza `remediation`/`conditions` ma con
`blockers`+`validation_plan`, `local_checks` come oggetti con
`agent_id`/`reviewed_paths`/`invariant`/`method`/`result`/`artifact`,
unita' `blocked` con `result_fingerprints` vuoto.

Corretto: il callback `session` di next-auth v4 copiava `accessToken` nella
sessione, che `/api/auth/session` restituisce INTEGRALMENTE al browser — con
scope `repo` era furto di token. Ora il token resta nel JWT e le route API lo
leggono con `getToken({req, secret})` (helper `getServerToken` in
`src/lib/auth.ts`). Regola: mai mettere segreti nell'oggetto sessione.
Aggiunti header di sicurezza in `next.config.mjs` (CSP, HSTS, X-Frame-Options,
nosniff, Referrer-Policy, Permissions-Policy).

Ancora aperti (non corretti): nessun rate limit su `/api/generate`
(quota OpenRouter esauribile); 5 vulnerabilita' npm nella catena
`@opennextjs/cloudflare` da verificare se finiscono nel bundle del Worker.

## Skill Forge — rate limit e guardrail (2026-11-05)

- KV `RATE_LIMIT` (id `eeb827ee94054a5fb7691ce305b001ad`) in `wrangler.jsonc`;
  dopo aver aggiunto un binding va rigenerato `npm run cf-typegen` (crea
  `cloudflare-env.d.ts` con `KVNamespace`).
- `src/lib/ratelimit.ts`: 3 generazioni/giorno, chiave `rl:<login>:<YYYY-MM-DD>`
  (giorno UTC), contatore con TTL 48h. `consumeQuota`/`readQuota` accettano un
  KV opzionale come 2o argomento, cosi' si testano con un KV in memoria.
- `src/lib/guardrails.ts`: tetti input/output, `wrapUntrusted` (rimuove i tag
  di confine iniettati), `GUARDRAIL_PROMPT` anti-prompt-injection,
  `validateSkillOutput` (frontmatter + name + description + titolo).
- `src/lib/ai.ts`: `chatCompletion(model, messages, temperature, maxTokens)`.
- La quota si consuma DOPO la validazione dell'input, prima di chiamare il
  modello: input rifiutato non costa una generazione.
- Test eseguiti con `npx tsx <file>.mts` (i file `.mts` fuori dal progetto non
  risolvono i path relativi; metterli nella root di skill-forge e cancellarli).

## Skill Forge — DNS (2026-11-05)

Zona Cloudflare `skillforge.eu.org` (id `718aec9161dfa10022c6f3b8bd16ec28`)
esiste ma e' **pending**: `eu.org` non ha delegato nessun NS al sottodominio,
quindi il dominio e' NXDOMAIN e la zona e' vuota. NS attesi da Cloudflare:
`achiel.ns.cloudflare.com`, `chloe.ns.cloudflare.com`. Senza quella delega
(da chiedere a eu.org) nessun record nella zona risolve e nessuna verifica
Google puo' passare.

Formato record di verifica Google (CNAME): nome = codice corto, valore =
`gv-<codice>.dv.googlehosted.com`, `proxied=false` (i CNAME di verifica non
vanno proxati). Esempi reali in k8s.io e asuc.org.

Il secret `$Cloudflare` NON e' un token API valido (74 char con spazi, inizia
per "CLOUDF..."); per l'API usare il token dei deploy. Non stamparlo mai.

### DNS: cosa e' gia' pronto (2026-11-05)

Tutto predisposto in attesa della delega NS da eu.org:
- CNAME `6dnhtnuiibnq` -> `gv-ci3wdrc3s6wqfh.dv.googlehosted.com` (proxied=false)
- AAAA `skillforge.eu.org` -> `100::` (proxied=true) + route
  `skillforge.eu.org/*` -> `skill-forge` (la route Workers richiede un record
  proxato sull'hostname; 100:: e' il segnaposto standard).

Il token dei deploy NON puo' creare custom domains (errore 10405 su
`accounts/*/workers/domains`), ma PUO' creare route su
`zones/*/workers/routes`. Quando eu.org deleghera' i NS e la zona andra'
`active`, non serve altro: il sito si servira' su https://skillforge.eu.org.

### www (2026-11-05)

Apex canonico, quindi `www` fa 301 -> apex (middleware `src/middleware.ts`,
testato). In Cloudflare: CNAME `www` -> `skillforge.eu.org` (proxato) + route
`www.skillforge.eu.org/*` -> `skill-forge`. In Next/OpenNext il middleware
compare nel build come "Proxy (Middleware)".

Trucco per testare il middleware senza deploy: importarlo in un file `.mts`
eseguito con `npx tsx` e chiamarlo con `new NextRequest(url, {headers:{host}})`.
Spoofare l'header Host verso il worker NON funziona: Cloudflare risponde 403.

### npm audit (2026-11-05)

`npm audit` segnalava 5 vuln (glob/minimatch) via
`@opennextjs/cloudflare` -> `@opennextjs/aws` -> `@node-minify/core`. Sia
`@opennextjs/cloudflare` sia `@opennextjs/aws` sono all'ultima versione:
il fix upstream non c'e'. Chiuse con `overrides` in package.json
(`glob ^14.0.2`, `minimatch ^11.0.4`). `@node-minify/core` bloccava
`glob@10.3.3` esatto, ma usa solo `globSync` e glob@14 mantiene l'export CJS:
la minificazione continua a funzionare (verificato con build OpenNext completa).

Fatto importante: quei pacchetti NON finiscono nel Worker distribuito.
Verifica: `wrangler deploy --dry-run --outdir` + grep di minimatch/node-minify
nel bundle finale -> 0 occorrenze. Le occorrenze di "glob" erano
globalThis/globstar (falsi positivi), non il pacchetto glob.

### Upload-Post (social posting) — 2026-11-05

Servizio **upload-post.com**: API unificata per pubblicare su X, YouTube, TikTok,
IG, LinkedIn e altri. Base `https://api.upload-post.com/api`.
**Autenticazione: header `Authorization: Apikey <KEY>`** (attenzione: NON
`Bearer`). Verificato: con `Apikey` -> 200 "Token is valid"; con `Bearer` -> 401.
La chiave dell'utente e' un **JWT HS256** (payload: email, exp 2126, jti), ma va
passata con lo schema `Apikey`. Endpoint di prova sicuro: `GET /uploadposts/me`.

Endpoint utili: `POST /upload` (video), `/upload_photos`, `/upload_text`
(X/LinkedIn/Facebook/Threads/Reddit/Bluesky/... crea thread automatici),
`/upload_document` (solo LinkedIn), `/uploadposts/status`, `/history`,
`/schedule`. Tutti accettano una lista `platforms`.

**Stato account (profilo `default`)**: X = @ImADev22 ("Devme"),
YouTube = @drixedits-h2m ("EditByDrix"), entrambi `reauth_required: false`.
**Trappola**: il campo `platforms` del profilo vale `["tiktok"]` ma gli account
X e YouTube sono presenti in `social_accounts` — quel campo non e' l'elenco
autorevole. Esiste un secondo profilo `edgepassport` (solo tiktok).

Chiave salvata come secret Cloudflare `UPLOAD_POST_API_KEY` (mai nel repo;
`wrangler secret put`, non compare in wrangler.jsonc ne' in cloudflare-env.d.ts).

### Marketplace delle skill (2026-11-05)

Feature grossa aggiunta su richiesta dell'utente: un marketplace pubblico dove
ogni utente GitHub pubblica le proprie skill, le scarica e mette una stella.
Deployata (Worker Version `4d384434-c649-4c7e-8b89-6c10ca56acea`, commit
`581bf7d` sul branch `cloudflare-workers`).

**Storage: Cloudflare D1**, database `skill-forge-marketplace`
(id `8d40d0e8-7f54-442c-b55a-6e6285e37fba`), binding **`MARKETPLACE`**,
migrazioni in `skill-forge/migrations/` (`wrangler d1 migrations apply ...
--remote`). Due tabelle: `skills` e `stars`.

**Decisione chiave: l'id pubblico e' `owner/slug`, non lo slug.** Lo slug da
solo non e' univoco — due autori diversi possono avere una skill omonima — e
l'id composto rende impossibile a un utente sovrascrivere la skill di un altro
(l'upsert e' limitato all'owner, e l'id risultante sarebbe diverso). Un dettaglio
che sarebbe stato un bug sottile: la prima stesura usava `slug` come chiave.

**Sicurezza**: l'identita' dell'autore viene SEMPRE dal token GitHub lato server
(`getServerAuth`), mai dal corpo della richiesta. `toggleStar` ricalcola il
conteggio da `COUNT(*)` sui fatti invece di incrementare a mano, cosi' non puo'
divergere; la PK `(skill_id, user_login)` impedisce il doppio voto a livello DB.

**localStorage** (`src/lib/localstore.ts`): ogni skill generata si salva subito
in locale, anche senza download/commit. Le funzioni accettano uno `Storage`
iniettabile, quindi la logica e' testabile senza browser. Le voci corrotte
vengono scartate invece di far cadere la pagina.

**Struttura**: logica pura in `src/lib/marketplace.ts`, query D1 in
`src/lib/marketplace-db.ts` (D1 iniettabile per i test). API sotto
`src/app/api/marketplace/` (`route.ts` lista, `publish/`, `star/`, `detail/`).
Pagina `src/app/marketplace/page.tsx`; dashboard riscritta come "Le mie
creazioni".

**Harness di test vero, finalmente.** `npm test` = `node --import tsx --test
tests/*.test.ts` (`tsx` aggiunto come devDependency). 34 test verdi. I test
"7/7" delle sessioni precedenti erano ad hoc e non versionati.

**Trappola Next 16**: `next lint` e' stato rimosso (`Invalid project directory
provided, no such directory: .../lint`). E non esiste una config ESLint nel
repo. `npx eslint` senza config si pianta. Quindi: niente lint, ci si affida a
`tsc --noEmit` + `next build`, che fanno gia' il type-check.

**Trappola `npm run preview`**: `opennextjs-cloudflare preview` fa la build E
avvia un server locale bloccante: non usarlo per la sola build, va in timeout.
Per la build: `opennextjs-cloudflare build` (o `npm run build` per Next).

### Cloudflare agent setup (2026-11-05)

`https://developers.cloudflare.com/agent-setup/prompt.md` e' il prompt ufficiale
di setup. L'ho eseguito (era stato saltato nei turni precedenti, nonostante il
primo messaggio lo chiedesse).

**Skills: fatte.** `npx -y skills add cloudflare/skills --skill '*' --yes
--global` installa 19 skill in `~/.agents/skills/` e le collega a OpenHands con
symlink in `~/.openhands/skills/` (`cloudflare`, `wrangler`, `cf-cli`,
`workers-best-practices`, `nextjs-on-cloudflare`, `durable-objects`,
`agents-sdk`, `turnstile-spin`, `web-perf`, `sandbox-*`, ...). Diventano
visibili all'agente solo dalla sessione successiva (l'elenco delle skill e'
calcolato all'avvio).

**MCP: NON registrato, e non e' registrabile da dentro il container.** Non
esiste un file di config MCP scopribile per questo agente: niente
`~/.openhands/settings.json`, `~/.openhands/profiles/` contiene solo un lock
vuoto, e il server MCP di Cloudflare (`https://mcp.cloudflare.com/mcp`, OAuth
al primo uso) si configura dalle impostazioni dell'app OpenHands, non da qui.
Non ho inventato un file di config in un percorso arbitrario.

**CLI `cf`: non installata di proposito.** Il prompt la segna come opzionale e
dice di chiedere prima. Il progetto ha `wrangler.jsonc`, quindi la skill
`cloudflare` dice comunque di usare Wrangler (non `cf`) finche' resta cosi'.

### Verifica Google e workers.dev (2026-11-05)

**`workers.dev` non e' una zona dell'account**: l'account ha solo
`skillforge.eu.org` ed `edgepassport.eu.org`. Non ci si possono creare record
DNS, quindi il TXT di verifica Google va per forza nella zona eu.org (che non
risolve finche' manca la delega NS). Per verificare il dominio workers.dev
l'utente deve usare il **meta tag** o il **file HTML**, non il TXT.

Soluzione adottata: entrambi i metodi senza DNS.
- `verification.google` in `src/app/layout.tsx` -> `<meta name="google-site-verification">`
  presente su ogni pagina.
- `public/googlehg9z_...html` con la riga `google-site-verification: google....html`.

**Trappola Cloudflare**: i file `.html` negli asset statici vengono serviti con
un **307** verso il percorso senza estensione (comportamento di default di
"html_handling"). Google vuole il file al percorso esatto. Fix: in
`wrangler.jsonc`, sotto `assets`, `"html_handling": "none"`. Verificato: dopo il
cambio il file risponde 200 con `content-type: text/html` al percorso esatto, e
tutte le pagine Next (generate al volo, non servite come .html da quella
cartella) restano 200.

### Sitemap, robots e l'host giusto (2026-11-05)

`sitemap.xml` e `robots.txt` erano costruiti su `legal.siteUrl`
(`https://skillforge.eu.org`), che non risolve finche' manca la delega NS.
Serviti da `workers.dev`, Google li avrebbe scartati: gli indirizzi elencati
appartenevano a un host diverso da quello che li serve.

Fix: `src/lib/site-url.ts`, helper `siteBase()` che legge l'origine della
richiesta (`x-forwarded-host` poi `host`, `x-forwarded-proto` poi `https`), con
`legal.siteUrl` come ripiego quando non c'e' una richiesta (build time).
`sitemap.ts` e `robots.ts` sono ora `async` e usano `siteBase()`.

Conseguenza voluta: la **stessa** sitemap e' corretta su `workers.dev` oggi e su
`eu.org` dopo la delega NS, senza toccare nulla. `legal.siteUrl` resta il canone
per `metadataBase`/OpenGraph in `layout.tsx`.

Da non confondere con la verifica Google: quella ha i suoi token (meta + file +
TXT) ed e' indipendente da dove punta la sitemap.

### Quota illimitata, velocita' e inglese (2026-11-05)

Tre richieste in un colpo (commit `e0870fa`, deploy Version `e5296282`).

**Quota illimitata.** `UNLIMITED_LOGINS` (vars in wrangler.jsonc, default
`ciao22king`) elenca i login esenti, separati da virgola. In `ratelimit.ts`,
`isUnlimited(login)` decide; per un esente `consumeQuota` **non tocca KV** e
restituisce `{ allowed: true, quota: { unlimited: true, remaining: Infinity } }`.
`Quota` ha ora il campo `unlimited`. La UI in CreateFlow mostra "Generazioni
illimitate" e non disabilita mai il pulsante. Aggiungere un altro esente = solo
una voce in `UNLIMITED_LOGINS`, nessun codice.

**Velocita' dei modelli.** Tre leve indipendenti:
1. Scala `MODELS` **invertita**: prima il modello piccolo (`liquid/lfm-2.5-2.6b`),
   che risponde subito, e solo se fallisce si sale fino al 550B. Prima era il
   contrario: si pagava sempre la latenza del modello enorme.
2. `provider: { sort: 'throughput', allow_fallbacks: true }` nel corpo della
   richiesta: OpenRouter sceglie il provider piu' veloce invece del piu'
   economico.
3. `ATTEMPT_TIMEOUT_MS = 25s` per tentativo via AbortController, piu' un
   `TOTAL_BUDGET_MS = 50s` nel loop di fallback (sotto `maxDuration = 60`). Il
   timeout di ogni tentativo e' `min(25s, tempo rimasto)`, cosi' nessun modello
   mangia il budget degli altri e la risposta parte sempre.

Tutti e 11 gli id modello sono stati verificati contro `GET
https://openrouter.ai/api/v1/models` (endpoint **pubblico**, nessuna chiave):
esistono tutti.

**Skill in inglese.** `SYSTEM_PROMPT`, `GUARDRAIL_PROMPT` e i prompt utente in
`generate/route.ts` sono ora in inglese, con l'istruzione esplicita "Write the
skill in English, always, whatever the language of the source material". La UI
resta in italiano.

**Test: 53** (erano 34). Nuovi file `tests/ratelimit.test.ts` (esenzione, KV non
toccato, blocco degli altri utenti), `tests/ai.test.ts` (scala, prompt) e
`tests/ai-client.test.ts` (forma della richiesta con `fetch` sostituito, errore
HTTP, interruzione del timeout).

**Nota per verificare l'output reale**: `OPENROUTER_API_KEY` e' un secret del
worker, non e' nello shell del container. Per provare una generazione end-to-end
serve una richiesta autenticata (cookie di sessione GitHub), non basta curl.

### Pubblicazione su GitHub rimossa (2026-11-05)

Commit `fc26609`, deploy Version `2f003e44`. La pubblicazione creava repository
e committava file con i permessi dell'utente; ora le skill si pubblicano **solo
sul marketplace** di Skill Forge.

- Eliminati `src/app/api/publish/route.ts` e `src/lib/github.ts` (nessun altro
  consumatore: `lib/github` era usato solo da quella route).
- `CreateFlow.tsx`: via il campo repository e il pulsante "Pubblica su GitHub",
  resta "Pubblica sul marketplace" accanto a "Scarica il file .md".
- **`auth.ts`: scope OAuth da `read:user user:email repo` a `read:user
  user:email`.** `repo` serviva solo a scrivere sui repository. Attenzione: gli
  utenti con sessione gia' attiva conservano il vecchio token; il nuovo scope si
  vede al prossimo login.
- Testi aggiornati in landing, metadata, dashboard, termini (sezione 5 ora
  "Pubblicazione sul marketplace"), privacy, cookie. La privacy ora dichiara che
  le skill pubblicate sono archiviate e visibili a chiunque.

`/api/publish` risponde 404. 53 test verdi, `tsc` pulito, tutte le pagine 200.
Nota: `tsc --noEmit` puo' fallire su `.next/types/validator.ts` che referenzia la
route cancellata; si risolve con `rm -rf .next` (artefatto di build, non codice).

### CLI Node e auth via bearer (2026-11-05)

Commit `0658202`, deploy Version `f90a4137`. La CLI sta in `skill-forge/cli/`
(vedi `cli/README.md`): pacchetto Node a se', **zero dipendenze a runtime**,
TypeScript compilato in `dist/` con `tsc`. Binari `skill-forge` e `sf`.

- **Il server ora accetta `Authorization: Bearer <token GitHub>`** oltre al
  cookie NextAuth (`src/lib/github-token.ts`, usato da `getServerAuth`). Il
  token viene verificato contro `api.github.com/user` a ogni richiesta. Il
  percorso del browser e' invariato. Nuovo endpoint `src/app/api/me/route.ts`
  (login + quota in una chiamata).
- **Il Device Flow di GitHub e' ora ABILITATO** su questa OAuth App (spuntato
  il 2026-11-05; prima rispondeva `device_flow_disabled`). `login` lo usa come
  percorso principale: codice a schermo, l'utente lo digita su
  `github.com/login/device`. Client ID pubblico `Ov23li3WNZ0SwllP72tP`
  (`cli/src/device-flow.ts`); il device flow non usa il client secret, quindi
  puo' stare nel pacchetto. Fallback non interattivo: `--token`,
  `$SKILL_FORGE_TOKEN`, `gh auth token`. `--no-device-flow` lo salta.
- Config CLI: `~/.config/skill-forge/config.json`, permessi **600** (contiene un
  token). `SKILL_FORGE_URL` / `SKILL_FORGE_TOKEN` vincono sul file.
- Comandi: login, logout, whoami, generate, publish, list/search, show, pull,
  star, delete. `generate --quiet | publish` funziona in pipe (markdown puro su
  stdout, messaggi su stderr).
- `skill-forge/tsconfig.json` **esclude `cli/`**: la build web non deve
  compilare il pacchetto CLI. `cli/` ha il proprio `tsconfig.json`.
- Test: **51 nella CLI** (`cd cli && npm test`, node:test + tsx) + 53 dell'app.
  L'e2e usa un server HTTP locale vero, non mock.

Verificato in produzione: `whoami` con token reale -> `ciao22king` illimitato;
`generate | publish` -> skill creata e poi cancellata con `delete --yes`.

### CLI pronta per npm (2026-11-05)

Pacchetto `skill-forge-cli` in `skill-forge/cli/`, versione `0.1.0`. **Non
pubblicato**: richiede login npm dell'utente (`npm login`), che l'agente non ha.
Nome `skill-forge-cli` **libero** su npm; anche `skill-forge` lo e' (404).

- `npm pack --dry-run`: 63 file, 27.8 kB. Contenuto: `dist/` + README + LICENSE +
  package.json. Le `*.map` sono incluse: innocue, ma volendo si tolgono dal
  tarball con `"files"` piu' stretti o `declarationMap: false` nel tsconfig.
- Installazione pulita da tarball **verificata**: `npm i <tgz>` in cartella vuota
  crea i bin `skill-forge` e `sf` e funzionano.
- `prepublishOnly` ora e' `npm run build && npm test`: non si pubblica con i test
  rossi.
- `LICENSE` MIT aggiunto in `cli/` (il package.json lo dichiarava ma il file non
  c'era). Aggiunto anche `*.tgz` a `cli/.gitignore`.
- Il `bin` punta a `dist/index.js`, che esiste solo dopo `npm run build`; per
  questo `prepublishOnly` compila. Chi installa non ha bisogno di compilare.

### CLI pubblicata su npm (2026-11-05)

**`@ciao22/skill-forge-cli@0.1.0`** — live su npm. Pagina:
https://www.npmjs.com/package/@ciao22/skill-forge-cli
`npm install -g @ciao22/skill-forge-cli` -> bin `skill-forge` e `sf`.

- Il nome **`skill-forge-cli` e' stato RIFIUTATO** (E403): "too similar to
  existing package `skillforge-cli`". npm suggerisce lo scope. Usare sempre
  **`@ciao22/skill-forge-cli`**. Non ritentare il nome non-scoped.
- **`npm publish` da' HTTP 202 "being processed"** e il pacchetto resta 404 sul
  registry per **~5 minuti**. Non e' un errore: aspettare e riprovare con
  `curl https://registry.npmjs.org/@ciao22%2Fskill-forge-cli`. Ci sono voluti
  ~5 min (14:07 -> 14:13).
- L'account npm e' **`ciao22`** (non `ciao22king`), con **2FA attiva**: la
  pubblicazione richiede OTP (`npm publish --otp=...`) oppure un token con
  "bypass 2FA". npm ha ristretto i token che aggirano la 2FA.
- Per pubblicare senza toccare `~/.npmrc`: scrivere il token in un file a parte
  e usare `npm publish --userconfig /tmp/.npmrc-token`. Cosi' non resta
  credenziale nella config globale.
- Versioni successive: alzare `version` in `cli/package.json` e ripetere
  `npm publish`. `prepublishOnly` compila e testa da solo.

### i18n IT→EN di sito e CLI (2026-11-05)

Richiesta utente: "devi fare tutto in inglese anche il sito cambia in inglese".
Tradotto **tutto**: UI, `src/lib/*`, API routes, metadata/SEO, pagine legali,
CLI, README/docs, workflow, scripts, `.env.example`, `wrangler.jsonc` e
**anche i commenti di codice e i test**. Unica eccezione voluta: il fixture
`'Caffè e Città'` in `cli/test/skill.test.ts` (verifica l'accento in `slugify`).

- Route `/termini` → `/terms` con `git mv` (aggiornati footer, sitemap, legal).
- Anchor `id="contenuto"` → `id="content"` (in `layout.tsx`/`page.tsx`).
- Landing: nuovo componente `InstallCommand` in `page.tsx` col comando
  copiabile `npm install -g @ciao22/skill-forge-cli` (+ copy button, `useState`).
- `og:locale` `it_IT` → `en_US`; `lang="en"`.
- Dopo: 53/53 test app, 51/51 CLI, build Next OK (route `/terms`), build CLI OK.

Pubblicazione npm della CLI (descrizione ora in inglese, `0.1.1`): **bloccata**.
`npm publish` → **E403 "Two-factor authentication or granular access token with
bypass 2fa enabled is required"**. Diagnosi definitiva via API npm
(`GET /-/npm/v1/tokens` col token): il token `ccc` (`npm_…9009k`) ha
`"bypass_2fa": false` e permesso `package:write`. La doc npm e' esplicita:
"Publishing to npm requires either: 2FA enabled on your account, OR a granular
access token with bypass 2FA enabled". L'utente **NON ha mai attivato la 2FA**,
quindi l'unica via e' un **granular access token con la casella "Bypass
two-factor authentication" SPUNTATA alla creazione**. La casella NON si puo'
attivare su un token gia' creato (vale solo al momento della creazione) — per
questo la spunta fatta dopo non ha avuto effetto.
- `npm whoami` col token risponde `ciao22` (auth ok), ma
  `npm profile get` → 403: dalla policy 2026 le azioni di account richiedono
  2FA interattiva anche con token bypass.
- `npm publish --otp=000000` da' lo stesso E403 (non e' un problema di OTP).
- `GET /-/npm/v1/tokens` e' utile per ispezionare `bypass_2fa` di un token.
- Dal **gen 2027** anche i token bypass-2FA perderanno il publish diretto:
  la strada a lungo termine e' **trusted publishing (OIDC)** da GitHub Actions,
  oppure **staged publishing**.
- La `0.1.0` su npm resta con la descrizione in italiano.

PR #1 era **già mergiata** su `main` (merge commit `50f9d77`): non ci si pusha
sopra. Nuova PR **#2** aperta da `cloudflare-workers` → `main`.

### CLI "command not found" dopo `npm i -g` (2026-11-06)

L'utente ha segnalato `zsh: command not found: skill-forge` dopo
`npm install -g @ciao22/skill-forge-cli`. **Non e' un bug del pacchetto**: il
tarball pubblicato (`0.1.0`) contiene `dist/index.js` col shebang
`#!/usr/bin/env node`, il campo `bin` mappa `skill-forge` e `sf`, e npm crea i
symlink in `<prefix>/bin`. Verificato con
`npm i -g --prefix /tmp/gprefix` → i symlink ci sono e `skill-forge --help`
funziona mettendo quella dir nel PATH.

Cause tipiche del "command not found": il prefix globale di npm non e' nel
PATH di zsh (spesso `~/.npm-global/bin`, `~/.local/bin`, o un prefix nvm), o la
hash cache di zsh. Rimedi: `npm config get prefix`, aggiungere `<prefix>/bin` a
`PATH` in `~/.zshrc`, poi `hash -r` (zsh: `rehash`). Con sudo installare con
`sudo npm i -g ... --unsafe-perm` o cambiare prefix.

Nota: la `0.1.0` su npm ha ancora le stringhe in **italiano** (pubblicata prima
della traduzione). Il fix inglese e' pronto come `0.1.1` ma la pubblicazione
resta bloccata dalla 2FA (vedi sotto).

### Deploy sito inglese su Cloudflare (2026-11-06)

`npm run deploy` (= `opennextjs-cloudflare build && opennextjs-cloudflare deploy`)
con `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` presenti nell'ambiente:
**riuscito**. Version ID **`d27b480e-d653-40f8-ad82-fe63373ce919`**, live su
`https://skill-forge.ciao22king.workers.dev`. La build NON ha bisogno delle env
in locale: i secret stanno sul Worker, i pubblici (`GITHUB_ID`,
`UNLIMITED_LOGINS`) in `wrangler.jsonc`. Verifica post-deploy (tutte 200):
`/`, `/terms`, `/privacy`, `/cookie`, `/marketplace`, `/dashboard`,
`/manifest.webmanifest`, `/sitemap.xml`; `/termini` → 404 (route rinominata);
`/api/me` → 401 senza auth. Contenuti confermati in inglese, `lang="en"`,
`og:locale` `en_US`, comando CLI presente nella landing.

**`skillforge.eu.org` e `www.skillforge.eu.org` NON risolvono ancora** (DNS
`Name or service not known`): la delega NS da eu.org non e' attiva. Problema
pre-esistente, non introdotto dal deploy. Il worker `.workers.dev` e' l'URL vivo.

La CLI **non** viene ripubblicata su npm (l'utente la gestisce da se').

### Marketplace: ranking trending + nav mobile + rimozione CLI (2026-11-06)

Richiesta utente: togliere npm dal sito, sistemare i tasti header su mobile,
aggiungere tab new/trending/top al marketplace "con un algoritmo potente", e
verificare le pagine legali.

- **Algoritmo trending** in `src/lib/marketplace.ts` (`TRENDING` + `orderClause`):
  punteggio = `(BASE + stars + VELOCITY_WEIGHT * stelleUltimi7g) /
  pow(oreEta + 2, GRAVITY)` con BASE=1, VELOCITY_WEIGHT=5, GRAVITY=1.5. E' una
  "velocity ranking" (chi guadagna stelle adesso batte chi le ha raccolte
  mesi fa). Costanti esportate cosi' UI e server non divergono.
- **D1 supporta `pow` ed `exp`/`ln`/`log`/`sqrt`** ma **NON `log10`** ("not
  authorized to use function: log10"). Verificare le funzioni SQL con
  `npx wrangler d1 execute <db> --remote --json --command "SELECT fn(...)"`
  prima di scriverle nel codice.
- Sort del marketplace ora: **Trending** (default), **New**, **Most starred**,
  **Name** (prima: Recent/Most starred/Name). `parseSort` accetta 'trending'.
- **Nav mobile**: aggiunto hamburger (`md:hidden`) con drawer; prima la riga di
  link desktop andava in overflow/clipping sugli schermi piccoli. I tab di sort
  sono diventati una riga scrollabile (`overflow-x-auto`, `role=tablist`).
- **Landing**: rimossa del tutto la sezione CLI/`InstallCommand` (l'utente non
  vuole piu' pubblicizzare npm); sostituita da `RankingPreview` (illustrazione
  statica dei tre ranking). Rimossa anche la keyword `CLI` dai metadata.
- **Legale**: il paragrafo su ordinamento algoritmico e' nella **sezione 5 dei
  Terms** (`src/app/terms/page.tsx`); `lastUpdated` in `src/lib/legal.ts` e la
  data della pagina terms portati a "November 6, 2026". Privacy e cookie NON
  richiedono modifiche (nessun nuovo dato personale: le stelle erano gia'
  documentate).
- Test: **54 app** (era 53), `tsc --noEmit` pulito. Deploy Version
  **`ccba8838-ec62-4a1d-9e2c-5590807e74cf`**. Verificato in prod: nessun
  "npm install" nella landing, tab presenti, `?sort=trending` risponde, menu
  mobile presente. Commit `313b6e1` pushato su PR #2 (ancora aperta).

---

## Growth/SEO: pagine pubbliche skill + OG image + share (2026-11-06, sessione 2)

Richiesta: "Aggiungi altro per far entrare più gente". Implementato:

- **Pagine pubbliche indicizzabili** `/s/[owner]/[slug]`
  (`src/app/s/[owner]/[slug]/page.tsx`): `runtime='nodejs'`,
  `dynamic='force-dynamic'` (D1 è bindata solo sul Worker a runtime, non al
  build). Legge da `getSkill(skillId(owner,slug))`, fa `notFound()` se assente.
  Include JSON-LD `CreativeWork` (autore, date, keywords), badge stelle/tag,
  bottone "Download .md" e componente `Share`.
- **Markdown renderer sicuro** (`src/lib/markdown.ts`): parser senza dipendenze
  che ritorna un **modello di blocchi tipizzato** (`heading`/`paragraph`/
  `list`/`code`), NON una stringa HTML. Il renderer React emette nodi di testo,
  quindi una skill malevola non può iniettare markup. Verificato: `<script>` in
  markdown esce come `&lt;script&gt;`.
- **OG image**: `src/app/opengraph-image.tsx` (convenzione file, **statica**,
  renderizzata al build). ⚠️ Un **route dinamico `next/og`** (`/api/og` con
  `ImageResponse` a runtime) **SI BLOCCA sul runtime Workers** — miniflare
  logga "code had hung and would never generate a response" e la richiesta va
  in 500. Usare SEMPRE la convenzione file statica per OG su OpenNext/Workers.
  Le pagine `/s/...` ereditano l'immagine dal layout (nessun `images:` custom).
- **Share** (`src/components/Share.tsx`, client): X, Reddit, Hacker News come
  anchor (no JS) + "Copy link" via `navigator.clipboard` con fallback.
- **Sitemap** (`src/app/sitemap.ts`): oltre alle pagine statiche, una entry per
  ogni skill via `listSkillRefs()` (nuova query leggera in `marketplace-db.ts`
  che seleziona solo `id, updated_at`, limit 5000, con try/catch). robots.ts
  invariato (`allow: '/'`).
- Card del marketplace: il titolo è ora un `<Link href={'/s/'+skill.id}>`.

Verifiche: **58 test** (era 54; +4 in `tests/markdown.test.ts`), `tsc` pulito,
`npm run build` OK. Provato su `opennextjs-cloudflare preview` (D1 locale,
migrazione `0001_marketplace.sql` + skill demo): `/s/ciao22king/demo-skill` →
200 con og/twitter/JSON-LD corretti; `/s/evil/xss` escapa lo script;
`/opengraph-image` → PNG 1200×630; sitemap elenca le skill; `npm install`
assente. Commit `c39add0` su branch `cloudflare-workers`.

### Deploy bloccato: token Cloudflare non valido
- Il secret **`Cloudflare`** = stringa `"CLOUDFLARE_API_TOKEN cfut_..."` (74
  char, separato da **spazio**, non `=`). Estrarre il token con
  `os.environ['Cloudflare'].split(' ',1)[1]` (non `.split('=')[1]`).
- **Ma il token è rifiutato**: `GET /user/tokens/verify` → "Invalid API Token"
  (code 1000), e `wrangler deploy`/`d1 --remote` → "Invalid access token"
  (9109). Rate-limit 10502 dopo tentativi ripetuti. → il token è scaduto/revocato;
  serve che l'utente lo rigeneri.
- Anche `CLOUDFLARE_API_TOKEN` iniettato automaticamente (stesso valore cfut_)
  è rifiutato. Le env `CLOUDFLARE_ACCOUNT_ID` NON sono presenti.
- Il repo **non ha** deploy CI: `.github/workflows/deploy.yml` è sotto
  `skill-forge/` (ignorato da GitHub); il root remoto ha solo
  `.agents`, `.openhands`, `skill-forge`, `skills-lock.json`. I deploy sono
  manuali → finché il token è invalido, il push NON deploya da solo.

### Cloudflare agent-setup (prompt ufficiale)
Eseguito `https://developers.cloudflare.com/agent-setup/prompt.md` (legittimo):
- `npx -y skills add cloudflare/skills --skill '*' --yes --global` → 19 skill
  Cloudflare in `~/.agents/skills/`, symlinkate in `~/.openhands/skills/`.
- MCP server Cloudflare registrato via l'API dell'agent-server locale
  (`http://localhost:60000`, NON 8001): la chiave è `SESSION_API_KEY`
  nell'env del processo `openhands-agent-server`
  (`tr '\0' '\n' < /proc/<pid>/environ | grep '^SESSION_API_KEY='`).
  `POST /api/settings/mcp/cloudflare` con
  `{"url":"https://mcp.cloudflare.com/mcp","transport":"streamable-http"}`.
  OAuth: `PATCH` con `{"auth":{"strategy":"oauth2"}}` poi
  `POST /api/mcp/oauth/start` → restituisce `authorization_url` (serve consenso
  dell'utente nel browser) + `job_id`; stato su
  `GET /api/mcp/oauth/status/{job_id}`.

### Token Cloudflare nuovo (2026-11-06 sera) — valido ma NON ancora attivo
L'utente ha fornito `cfat_HMzyIu1fU9xWhADriGebGqEDzWPH4G32chSOzyxybdcf9537`
(53 char). **Importante**: per i token **account-scoped** (`cfat_`) NON usare
`/user/tokens/verify` (→ "Invalid API Token", fuorviante). Usare l'endpoint
**scoped all'account**:
`GET /accounts/<ACCOUNT_ID>/tokens/verify` (con `ACCOUNT_ID` =
`69e8820212c184a7fb5ed2f0b913d551`). Risposta: `success:true`, token `active`,
ma `not_before = 2026-11-06T23:00:00Z` → **utilizzabile solo dalle 23:00 UTC**
(~4,7 h dopo la consegna). `expires_on = 2026-11-07T22:59:59Z`. Prima di
`not_before` ogni altra chiamata (D1 list, wrangler) → "Authentication error".
Deploy (quando attivo):
`CLOUDFLARE_API_TOKEN=<cfat_> CLOUDFLARE_ACCOUNT_ID=69e8820212c184a7fb5ed2f0b913d551 npx opennextjs-cloudflare deploy`.

### MCP: come registrare un server (2026-11-06)
I server MCP dell'agente vivono in **`~/.openhands/settings.json`** →
`agent_settings.mcp_config`. NON c'è un file `mcp.json`. Si gestiscono via API
dell'agent-server locale (`http://localhost:60000`), con
`X-Session-API-Key: $SESSION_API_KEY` (la chiave sta nell'env del processo
`openhands-agent-server`: `tr '\0' '\n' < /proc/$(pgrep -f openhands-agent-server|head -1)/environ | grep ^SESSION_API_KEY=`).
- `POST /api/settings/mcp/<name>` crea/aggiorna (201); `PATCH` modifica;
  `DELETE` rimuove; `POST /api/mcp/test` prova la connessione e lista i tool.
- Body: `{"url","transport":"streamable-http","description","auth":{...}}`.
  Strategie auth: `none`, `api_key` (`{strategy:"api_key",header_name,value}`),
  `bearer` (`value`), `header` (`headers:{...}`), `basic`, `oauth2`.
- **Le credenziali negli header vengono salvate cifrate (Fernet, prefisso
  `gAAAAA`)**; `GET /api/settings` le mostra mascherate (`**********`). File 600.
- **Trappola**: un **riavvio del container/sessione ricrea `~/.openhands/`** e
  quindi `settings.json` può risultare vuoto → i server MCP registrati vanno
  **ri-registrati**. Verificare sempre con `GET /api/settings` dopo un restart.

### Upload-Post MCP (social posting) — registrato 2026-11-06
Endpoint ufficiale `https://mcp.upload-post.com/mcp` (streamable-http, v0.17.3,
**72 tool**: `upload_video`, `upload_photos`, `upload_text`, scheduling, history,
analytics…). Auth: header `Authorization: ApiKey <UPLOAD_POST_API_KEY>` →
registrato con `auth:{strategy:"header",headers:{Authorization:"ApiKey <key>"}}`.
La chiave (JWT HS256, email `ciao22king@gmail.com`, exp 2126) è la stessa già
salvata come **secret Cloudflare `UPLOAD_POST_API_KEY`**; è stata recuperata dai
log della conversazione precedente (`/workspace/conversations/<id>/events/`), NON
va mai scritta nel repo né in memoria. Account collegati (profilo `default`):
X = @ImADev22, YouTube = @drixedits-h2m. Nota: `Bearer` è accettato dall'MCP ma
per l'API REST `/api` serve lo schema `Apikey`.

### Annuncio social di Skill Forge (2026-11-06)
Su richiesta: pubblicare un annuncio su **X e YouTube**. Vincoli scoperti:
- **YouTube non accetta post di solo testo** — `upload_text` ha enum piattaforme
  `x,linkedin,facebook,threads,bluesky,google_business,discord,telegram,slack,
  mastodon,nostr,lemmy,devto,hashnode,wordpress,whop,listmonk` (niente youtube).
  Per YouTube serve **video** (`upload_video`, `videoPathOrUrl` o `videoBase64`).
  `ffmpeg` non è installato nel container (serve `sudo apt-get install -y ffmpeg`).
- **X**: programmato con `upload_text` (`platforms:["x"]`, `user:"default"`,
  `linkUrl` workers.dev, `scheduledDate:2026-11-06T23:30:00Z`).
  `job_id=cc4dd6c4138f485c8304a1285e481c6e`. Motivo dell'orario: far precedere il
  **deploy delle 23:00** così il link ha già la OG image (altrimenti il card è
  vuoto). Testo: "Skill Forge 🔥 / Turn scattered notes, docs or a single idea
  into a complete, detailed skill for AI agents. / ✨ Generate → 📦 Download or
  publish to the public marketplace / Free 👉 <url> / #AI #AIAgents #DevTools".
- **Upload-Post richiede conferma in due passi**: la prima chiamata a `upload_*`
  senza `confirmed:true` restituisce solo una **preview** (`executed:false`),
  niente viene inviato; si ripete identica con `confirmed:true`.
- Account: profilo `default` → X @ImADev22 ("Devme"), YouTube @drixedits-h2m
  ("EditByDrix"). Helper locale per chiamare l'MCP a mano: `/tmp/mcptool.py`
  (non contiene segreti; la chiave si passa come argomento).
- `skillforge.eu.org` **continua a non risolvere** (NS eu.org non delegate):
  i link pubblici usano `https://skill-forge.ciao22king.workers.dev`.

### Upload-Post: limiti e trappole (2026-11-06) — IMPORTANTE
- **Piano free = 10 upload per mese** (ogni piattaforma conta 1). L'account
  `ciao22king@gmail.com` è a **9 usati** (history: 4 X + 5 YouTube, tutti tra il
  23 e il 27 ott) → **1 slot residuo**. L'X programmato per il 23:30 lo consuma.
  Dopo, ogni upload (anche YouTube) fallisce con "monthly limit of 10 uploads,
  0 remaining". Upgrade: https://app.upload-post.com/pricing
- **X cancella gli URL dai post** per default (X Links add-on li mantiene):
  "By default, Upload-Post strips every URL from posts published to X". Quindi
  il post X non deve contenere link, altrimenti resta un "Free 👉" penzolante.
  → Il testo X è stato riscritto senza URL ("Free to try. Just search \"Skill Forge\".")
  con `edit_scheduled` (job `cc4dd6c4138f485c8304a1285e481c6e`).
- **YouTube NON accetta post di testo** (`upload_text` enum senza youtube);
  serve `upload_video`. Il video va **staged** (MCP remoto, niente path locale):
  `create_media_upload` (filename/contentType/contentLength/mediaType) →
  **PUT** dei byte su `upload_url` (R2 presigned, scade ~6 h) →
  `complete_media_upload` → `media_url` temporaneo da passare a `upload_video`.
- **Video promo creato** (2026-11-06): `/workspace/project/.skill-forge-deploy/
  skillforge_short.mp4` — 1080×1920, 23,5 s, H.264, 2,6 MB, 30 fps. Generato con
  `PIL`+`ffmpeg` (installati in sessione: `sudo apt-get update && sudo apt-get
  install -y ffmpeg`; `pip install pillow numpy`). Scene: intro → problema →
  4 mockup telefono (screenshot reali del sito, anche pagina pubblica `/s/...`
  resa in locale con `wrangler dev --local` + D1 locale seminata) → CTA.
  Script: `/tmp/vid/make_video.py` (volatile). Colori brand da OKLCH: accent
  `#bb4632`, ink `#24130c`, surface `#fcf4eb`.

### Composio MCP (2026-11-06) — richiede OAuth interattivo
Endpoint `https://connect.composio.dev/mcp` (streamable-http). **Solo OAuth**
(`Authorization: Bearer`), nessuna API key: `initialize` senza token → 401
"Authorization required". Discovery: authorization_endpoint
`https://connect.composio.dev/oauth/authorize`, token su
`login.composio.dev/oauth2/token`, scopes `openid profile email offline_access`.
Registrato in `~/.openhands/settings.json` con `auth:{strategy:"oauth2"}`.
`POST /api/mcp/oauth/start` vuole `{"name":..., "server":{"type":"streamable-http",
"url":...,"auth":{"strategy":"oauth2"}}}` (NON `server_name`), restituisce
`authorization_url` + `job_id`; stato su `GET /api/mcp/oauth/status/{job_id}`.
**Problema**: il `redirect_uri` è `http://localhost:<porta>/callback` — un
listener DENTRO il container. Il browser dell'utente è remoto → il callback su
localhost non torna al container. Il login Composio va fatto in un browser che
raggiunge il container, oppure serve un token/API key. La sessione del browser
dell'agente NON è autenticata su Composio (solo cookie CSRF WorkOS).
**Nota**: "ho connesso Gmail" NON basta per i social — in Composio ogni app
(X, YouTube, IG, TikTok…) va connessa separatamente (toolkit diversi). Gmail
abilita solo i tool Gmail. Per pubblicare serve connettere il toolkit della
piattaforma. Se si connette **YouTube** in Composio, si può caricare il video
via Composio **aggirando il limite di 10 upload/mese di Upload-Post**.

### Deploy riuscito + X pubblicato (2026-11-07)
- Il **watcher è morto** prima delle 23:00: i riavvii container lo uccidono e lui
  NON sopravvive (le note precedenti che dicevano il contrario erano sbagliate).
  Token Cloudflare attivato 2026-11-06T23:00Z ma nessun deploy era partito.
  **Deploy fatto a mano** il 7/11 ~09:40 UTC:
  `CLOUDFLARE_API_TOKEN=... npx opennextjs-cloudflare deploy` → Version ID
  `50e0bf6e-48fa-4852-8923-7f9fde66f9a0`. Verificato: `/opengraph-image` ora
  **200 image/png 89 KB** (prima 404). Il sito nuovo è live.
- **Post X pubblicato** il 6/11 alle 23:30 UTC:
  https://x.com/ImADev22/status/2118848413244457440 — lo scheduling è server-side
  su Upload-Post, quindi è partito anche col watcher morto. Link rimosso da
  Upload-Post (X Links add-on assente) → testo pubblicato senza URL.
- **Upload-Post 10/10 upload/mese**: esaurito. Niente altri upload fino a upgrade
  o reset del contatore.

### Composio: accesso programmatico (2026-11-07)
- `https://connect.composio.dev/mcp` è **OAuth-only per i client** (Claude, Cursor,
  Codex…). `redirect_uri` = `http://localhost:<porta>/callback` **dentro il
  container**, e **il browser dell'agente RAGGIUNGE quel localhost** (verificato
  servendo `python3 -m http.server 56391`). L'OAuth callback funzionerebbe, MA il
  browser non è loggato su Composio (solo cookie CSRF WorkOS) → serve login umano.
- Per uso **programmatico** conviene la **REST API Composio**, non l'MCP:
  `POST https://backend.composio.dev/api/v3.1/tools/execute/<TOOL>` con header
  `x-api-key: $COMPOSIO_API_KEY` (project API key dal dashboard). Serve che
  l'utente crei la API key e connetta il toolkit (es. YouTube) con consenso OAuth.
- **Gmail ≠ social**: ogni app (X, YouTube, IG, TikTok…) è un toolkit separato da
  connettere. Connettere Gmail abilita solo i tool Gmail.
- CLI login umano senza browser locale: `composio login --no-wait` (stampa URL) →
  l'utente apre su un suo device → `composio login --poll`. Install:
  `curl -fsSL https://composio.dev/install | sh` (curl|bash: richiede consenso).

### Composio OAuth COMPLETATO + YouTube (2026-11-07) — svolta
- **OAuth Composio riuscito!** Il flusso MCP di OpenHands usa `redirect_uri=http://localhost:<porta>/callback`
  **dentro il container**; il browser dell'utente NON lo raggiunge, ma l'URL col `code`
  resta nella barra → si completa con `POST /api/mcp/oauth/callback/{job_id}`
  (header `X-Session-API-Key`, body `{"callback_url":"..."}`). Utile ma **non basta**:
  il probe di OpenHands va in timeout a 15s listando i tool Composio e **non salva il token**.
- **Soluzione robusta**: registrare un **proprio client OAuth pubblico** con PKCE
  (`POST https://login.composio.dev/oauth2/register`, `token_endpoint_auth_method=none`),
  far approvare all'utente l'auth URL, scambiare il code su
  `https://login.composio.dev/oauth2/token` (`code_verifier`), e chiamare l'MCP
  `https://connect.composio.dev/mcp` con `Authorization: Bearer <access_token>`.
  Refresh token funziona (grant `refresh_token`). Credenziali in
  `/workspace/project/.skill-forge-deploy/creds/` (600, **fuori dal repo**).
- Tool MCP Composio: 12 meta-tool (`COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_MULTI_EXECUTE_TOOL`,
  `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_MANAGE_CONNECTIONS`, …). Il gateway è **lento
  a listare** i tool (timeout 15s) ma le chiamate singole sono veloci (<1s).
- **Account connessi**: gmail `ciao22king@gmail.com` (attivo) e **youtube attivo** —
  canale **EditByDrix** (@drixedits-h2m, id `youtube_asylum-fillip`). **Gmail ≠ YouTube**:
  ogni toolkit va connesso a parte.
- **Upload file su YouTube**: `YOUTUBE_MULTIPART_UPLOAD_VIDEO` richiede
  `videoFile={name,mimetype,s3key}` dove `s3key` è uno staging Composio. Si ottiene nel
  sandbox: `from composio_helpers import upload_local_file; upload_local_file(path)`.
  Il workbench sandbox ha rete e `/mnt/files`; **non** condivide il filesystem del container.
- **Blocco attuale**: `RESOURCE_EXHAUSTED / 429 — Video Uploads per day` sul **progetto
  Google condiviso di Composio** (966/giorno, esaurito). **NON** è il limite di Upload-Post.
  Reset stimato ~**2026-11-08 08:00 UTC** (window_start 1794038400).
- **Publisher automatico**: `/workspace/project/.skill-forge-deploy/publish_youtube.py`
  (refresh token → re-stage video via workbench → upload; ritenta ogni 30 min per 36h).
  Si auto-avvia da un hook in `~/.bashrc` (nessun cron/systemd nel container). Log:
  `publish-youtube.log`. Serve `python3 -m http.server 12000` in `preview/` per l'URL video.
- Host pubblici di file: catbox/0x0/litterbox **rifiutano** ("Invalid uploader"); tmpfiles.org
  accetta ma è temporaneo. Per questo lo staging passa dal sandbox Composio.

### Connettori Composio reali + Dev.to pubblicato (2026-11-07)
- **Solo 3 connettori attivi** oltre a Gmail/YouTube: **reddit**, **discord**, **devto**.
  Gli altri (twitter, instagram, facebook, linkedin, tiktok, notion, github, slack…)
  risultano `initiated` = **non connessi**.
- **Dev.to PUBBLICATO** via `DEVTO_CREATE_ARTICLE` (account `devto_dimit-fester`,
  utente **imadev22** / ImADev):
  https://dev.to/imadev22/skill-forge-turn-scattered-notes-into-complete-reusable-skills-for-ai-agents-401j
  (verificato 200). L'articolo ha `canonical_url` → il sito, `main_image` → opengraph-image.
- **Reddit** (account `reddit_anal-like`): **0 subreddit iscritti**; `subreddits/mine`
  dà 429 rate-limit facilmente. Postare su un subreddit pubblico scelto a caso rischia
  il ban dell'account → **serve approvazione utente**.
- **Discord** (account `discord_toast-laden`, utente `el_gamer25_25977` / Gam3r🎮,
  email ciao22king@gmail.com): 17 server, **4 di proprietà** (Lacustri DiTemu, BuildADev,
  Vehicles Plus, ChatFree). Ma **postare richiede il toolkit `discordbot`** (token bot),
  NON connesso → i tool `DISCORDBOT_*` danno "No active connection found for 'discordbot'".
  I tool utente (DISCORD_LIST_MY_GUILDS, DISCORD_GET_MY_USER) funzionano solo in lettura.
- **Gmail** = invio email: NON usarlo per spam/annunci a terzi.

### Pubblicazione multi-canale via Composio (2026-11-07, agg.)
- **Composio può GENERARE i link di connessione a un click**:
  `COMPOSIO_MANAGE_CONNECTIONS {toolkits:[{name,action:"add"}]}` → se il toolkit ha
  managed auth restituisce `redirect_url` (`https://connect.composio.dev/link/...`).
  Se NON ha managed auth (twitter, threads, instagram, facebook, tiktok…) risponde
  "user must set up their own auth config" con link al dashboard → serve app OAuth propria.
- Connettori con managed auth (link pronti): linkedin, telegram, hashnode, discordbot,
  reddit, devto, notion, slack, github, pinterest.
- **Stato connettori attivi (2026-11-07 10:2x)**: devto (imadev22), discord, gmail,
  hashnode, pinterest (ciao22king), reddit (UpbeatBag5537), youtube (×2).
- **Pinterest PUBBLICATO**: creata board "Skill Forge" (`1125548200563604519`) +
  pin `1125548131922912702` → https://www.pinterest.com/pin/1125548131922912702/
  (immagine = opengraph-image del sito, `media_source={source_type:"image_url",url:...}`).
- **Hashnode BLOCCATO**: `HASHNODE_ME` fallisce (query GraphQL con campi deprecati
  `followersCount`/`followingsCount` → HTTP 400) e `HASHNODE_LIST_PUBLICATIONS` → 0
  pubblicazioni. Il tool è rotto lato Composio; serve una pubblicazione Hashnode.
- **Reddit**: `REDDIT_LIST_SUBSCRIBED_SUBREDDITS` → **0**; `subreddits/mine` dà 429
  facilmente. Postare in un sub pubblico non scelto dall'utente = rischio ban.
- **Discord**: serve toolkit `discordbot` (token bot) per scrivere; i tool utente
  sono solo in lettura.

### Reddit r/SideProject (2026-11-07)
- Account **UpbeatBag5537** (reddit_anal-like): creato ~2026-03, **0 karma** → gli automod
  filtrano facilmente. `r/SideProject` ha `restrict_posting: True`.
- Post link creato: **id `1xq38n0`**,
  https://www.reddit.com/r/SideProject/comments/1xq38n0/skill_forge_turn_scattered_notes_into_complete/
  Formato richiesto dal sub: `[Nome] - [Descrizione breve]`.
- **Verifica inconcludente**: reddit.com blocca curl e il browser dell'agente
  ("blocked by network security"); i listing API (`/new`, `/user/.../submitted`)
  tornano **vuoti** → probabile auto-filtro per account nuovo. Serve check da loggato.
- Tool Reddit Composio: `REDDIT_GET` richiede `sort` (400 se manca); `REDDIT_RETRIEVE_REDDIT_POST`
  richiede `subreddit` e ignora `id` (restituisce un listing). Verifica poco affidabile.

### Catalogo Composio + LinkedIn pubblicato (2026-11-07)
- **LinkedIn PUBBLICATO** (account `linkedin_wearer-delhi`, profilo "Ciao" id `U0CikiARb7`):
  `LINKEDIN_CREATE_LINKED_IN_POST` con `author=urn:li:person:U0CikiARb7`,
  `visibility=PUBLIC` → `urn:li:share:7524785068330881024`.
- **Toolkit collegabili a un click (managed auth)**: airtable, asana, beehiiv, bitbucket,
  box, brevo, calendly, clickup, coda, confluence, devto, discord, discordbot, dropbox,
  facebook, framer, github, gitlab, gmail, googledocs/drive/sheets, gumroad, hashnode,
  hubspot, instagram, intercom, jira, linear, linkedin, mailchimp, monday, notion, outlook,
  pinterest, reddit, salesforce, sendgrid, slack, stripe, telegram, todoist, trello, twitch,
  typeform, webflow, whatsapp, wix, youtube, zendesk, zoho, zoom.
- **Esistono ma servono app OAuth proprie**: docusign, hackernews, shopify, snapchat,
  soundcloud, spotify, threads, tiktok, twitter, vimeo.
- **Non esistono su Composio**: medium, wordpress, substack, bluesky, mastodon, producthunt,
  blogger, squarespace, ghost, patreon, kofi, quora, stackexchange, stackoverflow…
- **Hashnode**: blog dell'utente = `imadev.hashnode.dev`, ma l'API risponde
  "Publication does not have an active Pro plan" → **Hashnode ha chiuso l'API gratuita**.
  Inoltre `HASHNODE_ME` è rotto (GraphQL campi deprecati followersCount/followingsCount).
- **Reddit**: post r/SideProject `1xq38n0` **RIMOSSO** (account 0 karma, restrict_posting).
  NON fare vote-farming (viola la policy → shadowban). Meglio: commenti genuini o sub piccoli.

### Automazione OpenHands "Skill Forge daily social post" (2026-11-07)
- **API automazioni**: host `https://app.all-hands.dev`, auth `Authorization: Bearer $OPENHANDS_API_KEY`.
  Endpoint: `/api/automation/v1` (POST crea), `/uploads?name=` (POST tarball, gzip, 1MB),
  `/kv/{key}?automation_id=<uuid>` (PUT/GET), `/{id}/dispatch` (POST), `/{id}/runs`.
  Capabilities: triggerKinds cron+event, maxAutomationTimeoutSeconds 1800.
- **Automazione creata** (deterministica, **no LLM → costo zero**):
  id `31537c81-515c-4e22-b1c7-169fa35f48cc`, cron `0 9 * * *` Europe/Rome,
  entrypoint `python3 main.py`, timeout 300. Codice in
  `skill-forge/automations/daily-social/main.py` (+README). Tarball `oh-internal://uploads/78538f6d-...`.
- **Cosa fa**: ogni giorno pubblica su **LinkedIn + Pinterest** via gateway MCP Composio,
  scegliendo il testo da un pool di 6 (rotazione). Stato in KV: `rotation` (int) e
  `last_run` (timestamp+esito). Credenziali in KV chiave `composio`
  (`{client_id, refresh_token}`); il refresh token viene riscritto quando ruota.
- **Run manuale di test → COMPLETED** e ha pubblicato davvero
  (LinkedIn `urn:li:share:7524787372434079744`, pin creato; rotation 0→1).
- **Attenzione**: il sandbox dell'automazione è separato da questo container → le
  credenziali NON si leggono da `/workspace/.../creds`, vanno nella KV. I MCP server
  di `~/.openhands/settings.json` non sono automaticamente disponibili allo script:
  lo script parla direttamente con `https://connect.composio.dev/mcp`.
- Aggiornare l'automazione = ricaricare il tarball e PATCH `tarball_path`.

### Sito: pagine tag/autore + RSS (2026-11-07)
Commit `979389b` (branch `cloudflare-workers`; il deploy parte da `main`).
Nuove feature di **scoperta**, tutte server-rendered con `force-dynamic`:
- `/tags` (indice tag con conteggi), `/tags/[tag]` (skill di un tag, ordinamento trending),
  `/u/[owner]` (tutte le skill di un autore, avatar GitHub, login validato con regex),
  `/feed.xml` (RSS 2.0 delle ultime 50 skill). Chips dei tag ora link in
  `s/[owner]/[slug]` e in `/marketplace`; Nav e Footer hanno il link "Tags"; il
  layout dichiara l'autodiscovery RSS.
- **Trappola tag**: `tags` è una stringa CSV, quindi un `LIKE '%git%'` matcherebbe anche
  `github`. `tagClause` in `lib/marketplace.ts` avvolge colonna e termine tra virgole
  (`(',' || tags || ',') LIKE '%,git,%'`). `aggregateTags`/`tagCounts` aggregano in JS su
  un numero limitato di righe, non in SQL.
- **RSS**: l'escaping XML è estratto in `lib/feed.ts` (`escapeXml`/`buildFeed`) e testato
  — i titoli arrivano da skill pubblicate da chiunque.
- `next dev` **genera `AGENTS.md`** nella root di skill-forge (agent rules): aggiunto a
  `.gitignore`, non committarlo. `next lint` è **rimosso** in Next 16: il type-check lo fa
  `npm run build`.
- Test: **72** (erano 58), +7 in `tests/marketplace.test.ts`, +7 in `tests/feed.test.ts`.
  `npm run build` OK; verificate a runtime (dev server) `/tags`, `/tags/[tag]`, `/u/[owner]`,
  `/feed.xml` → 200 con dati reali da D1.

### Landing: conteggio utenti registrati (2026-11-07)
Commit `e8f9ee9`, **deployato** (Version `a26330d2`). Prima di questo deploy il
sito live era FERMO al 2026-11-07T09:40 → le feature tag/autore/RSS **non erano
online**; ora lo sono (`/tags`, `/feed.xml`, `/u/...` → 200).
- **"Registrato" = login GitHub.** Non esisteva una tabella utenti: l'ho creata
  (`migrations/0002_users.sql`, `users(login PK, first_seen, last_seen)`).
  `signIn` in `lib/auth.ts` registra il login, **senza mai bloccare** l'accesso.
- **Backfill**: la migration inserisce anche gli autori e chi ha messo stelle
  (da `skills.owner` e `stars.user_login`), così il numero non parte da 0.
- **`D1Like` ora in `lib/d1.ts`** (`getDatabase` + `D1Statement` con i metodi
  terminali direttamente sullo statement, non solo dopo `bind`). `marketplace-db.ts`
  lo re-esporta. **Trappola TS**: se `prepare().first()` dà "Property 'first' does
  not exist", il tipo è troppo stretto.
- **Home**: `app/page.tsx` è ora un **server component** che legge il conteggio e
  renderizza `components/Landing.tsx` (client, `userCount` prop). Così il numero è
  nell'HTML (SEO) e non serve fetch post-hydration. Conteggio **nascosto** (non "0")
  se D1 manca.
- **Deploy**: il branch di lavoro `cloudflare-workers` è **68 commit avanti** da
  `main`; il deploy è **diretto** (`npm run deploy` = `opennextjs-cloudflare
  deploy`), NON passa da `main` né da PR. Token CF attivo, `CLOUDFLARE_ACCOUNT_ID=69e8820212c184a7fb5ed2f0b913d551`.
- Test: **81** (erano 72). `skillforge.eu.org` **non risolve** ancora (delega NS
  eu.org pendente): il live va testato su `skill-forge.ciao22king.workers.dev`.

### Conteggio utenti: visibilita' (2026-11-07)
Commit `8e895af`, deploy Version `3d5886bd`. L'utente ha detto "il conteggio non
c'e'": in realta' **c'era** (curl 12/12 + browser reale su
`skill-forge.ciao22king.workers.dev`). Era solo **poco visibile**: riga 12px
grigia sotto i pulsanti. Ora e' un blocco stat nella hero (numero in
`font-display text-4xl` accent + etichetta sotto, separato da una hairline).
- **"Pending" = zona DNS `skillforge.eu.org`**, non il conteggio: la zona e' in
  stato `pending` (delega NS eu.org non ancora pubblicata → NXDOMAIN pubblico).
  La route Worker `skillforge.eu.org/*` esiste gia', ma senza delega il dominio
  canonico **non risolve**. Per vedere il sito serve `…workers.dev`.
- **Trappola grep**: React inserisce `<!-- -->` tra numero e testo, quindi
  `grep "1 user registered"` NON matcha. Cercare `registered` o usare una regex
  `[0-9]+\s*(?:<!-- -->)?\s*users?`.

### Perche' le view non salivano: canonical/OG su un dominio morto (2026-11-07)
Commit `367f721`, deploy Version `a899c810`. **Causa vera del "non stiamo
migliorando le views"**: `legal.siteUrl` era `https://skillforge.eu.org`
(NXDOMAIN, zona pending). Da li' derivavano `metadataBase`, `<link
rel=canonical>`, `og:url`, `og:image`, `twitter:image` e il `CANONICAL_HOST` del
middleware. Quindi **ogni link condiviso e ogni anteprima social puntavano a un
host morto**: chi cliccava non arrivava al sito. Ora `siteUrl` = default
`https://skill-forge.ciao22king.workers.dev` e il middleware ricava
`CANONICAL_HOST` da `new URL(legal.siteUrl).host` (niente piu' hardcode).
**Quando eu.org sblocca**, basta settare `NEXT_PUBLIC_SITE_URL=https://skillforge.eu.org`
e ridistribuire: tutto torna canonico senza toccare il codice.

### Automazione social quotidiana (2026-11-07)
- **Esiste gia'**: `automations/daily-social/` (+ copia in
  `/workspace/project/.skill-forge-deploy/daily-social/`), automation id
  `31537c81-515c-4e22-b1c7-169fa35f48cc`, cron `0 9 * * *` Europe/Rome,
  entrypoint `python3 main.py`. Pubblica su **LinkedIn** (`linkedin_wearer-delhi`)
  e **Pinterest** (`pinterest_labor-arrie`) via **Composio MCP**
  (`https://connect.composio.dev/mcp`). Copy ruota su 6 post fissi (KV `rotation`).
- **API automations** (host `https://app.all-hands.dev`, auth `Bearer $OPENHANDS_API_KEY`):
  `GET /api/automation/v1` (lista), `GET /api/automation/v1/{id}/runs`,
  `POST /api/automation/v1/{id}/dispatch` (run manuale),
  `GET|PUT /api/automation/v1/kv/{key}?automation_id={id}`.
  NB: `…/automations/{id}` NON esiste (404); la lista e' il path nudo.
- **Trappola Composio**: le credenziali stanno in KV `composio`
  (`{client_id, refresh_token}`). Il refresh token **ruota ad ogni uso**, quindi
  se qualcun altro lo usa (es. `publish_youtube.py`) quello in KV diventa
  `invalid_grant`. Fix: rigenerare da `creds/comp_token.json` (il locale resta
  valido) e riscrivere il KV. Il token **in KV era rotto**, l'ho riparato e
  verificato con un run manuale (post LinkedIn + pin Pinterest riusciti).
- `publish_youtube.py` carica uno Short su YouTube ma e' **bloccato da
  `QUOTA_EXCEEDED`** (quota Composio condivisa, reset ~08:00 UTC).
- Il video promo e' `skillforge_short.mp4`; serve `python3 -m http.server 12000`
  in `preview/` per farlo scaricare a Composio.
- **Token CF**: quello nel `deploy-when-ready.sh` funziona per l'API Workers ma
  `tokens/verify` risponde "Invalid API Token" (scope ridotti). Usare
  `CLOUDFLARE_API_TOKEN=$(grep -o "cfat_[A-Za-z0-9]*" …/deploy-when-ready.sh|head -1)`.
  Il secret `Cloudflare` del container e' una coppia `CLOUD… cfut…` **non valida**
  come bearer token.

### Analytics (Cloudflare Web Analytics) — e il CSP che lo bloccava (2026-11-07)
Richiesta utente: "non stiamo migliorando le views". Il sito **non aveva alcun
analytics**. Aggiunto il beacon **Cloudflare Web Analytics** (gratis, senza
cookie → niente banner, coerente con `/cookie`).
- **RUM site** creato via API: `POST /accounts/$ACC/rum/site_info`
  `{"host":"skill-forge.ciao22king.workers.dev"}`. Site tag (pubblico)
  `9d40be2ece8d4cb0be14e47e1c2f2039`. Elenco: `GET …/rum/site_info/list`.
- **Beacon**: in `src/app/layout.tsx`, `<script defer src=
  "https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":…}'>`,
  token da `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` (default = tag live; vuoto = disattiva).
  **Non** usare `next/script`: con `afterInteractive` il tag NON finisce nell'HTML
  SSR. Un `<script defer>` semplice sì (verificato).
- **TRAPPOLA GROSSA — il CSP di `next.config.mjs`**: `script-src 'self'
  'unsafe-inline'` + `connect-src 'self'` **bloccavano** il beacon (script da
  `static.cloudflareinsights.com`, POST a `cloudflareinsights.com/cdn-cgi/rum`).
  Sintomo: **zero dati RUM per sempre**, senza errori server. Fix: aggiunti
  `https://static.cloudflareinsights.com` a `script-src` e
  `https://cloudflareinsights.com` a `connect-src`. **Ogni volta che aggiungi
  uno script/endpoint esterno, aggiorna questo CSP.**
- **Come verificare davvero** (i dati RUM tardano ~30 min, quindi non fidarti
  dell'API): headless Chromium + CDP `Network.*`. `chromium --headless=new
  --no-sandbox --remote-debugging-port=9333 --remote-allow-origins=*`, poi
  websocket-client su `/json` → `Network.enable` + `Page.navigate`. Conferma
  `REQ/RESP 200` verso `cloudflareinsights.com/cdn-cgi/rum`. (Ho dovuto
  `pip install websocket-client`.)
- **Query dati RUM** (GraphQL, richiede **filtro di data** o dà errore
  "time range wider than 13w2d"): `rumPageloadEventsAdaptiveGroups(filter:
  {siteTag:$tag, datetime_geq:$since})`. Dopo ~1h dall'attivazione: 0 righe
  (atteso, il traffico reale e' quasi nullo — ecco perche' le "views" non si
  vedono: non c'e' traffico, e i link erano rotti).
- Deploy: Version `9fd494a2` (beacon SSR) poi `fec8fe69` (fix CSP).
- Nota: `POST https://cloudflareinsights.com/cdn-cgi/rum` con curl → 404
  (serve il payload/UA giusti); col browser reale → 200. Non concludere nulla
  da un curl diretto.

### Cloudflare agent setup (prompt ufficiale) — 2026-11-07
Richiesta: eseguire `https://developers.cloudflare.com/agent-setup/prompt.md`.
Sezione "other agents": skills + MCP.
- **Skills**: `npx -y skills add cloudflare/skills --skill '*' --yes --global`
  → installa 22 skill in `~/.agents/skills/` e le **symlinka in
  `~/.openhands/skills/`** (e' cosi' che OpenHands le vede). Lock in
  `~/.agents/.skill-lock.json`. (`npx skills` e' interattivo senza `--yes`.)
- **MCP**: OpenHands scopre i plugin in `~/.agents/plugins/`, `~/.openhands/plugins/`
  e `<git_root>/.agents|.openhands/plugins/` (`openhands.sdk.plugin.discovery`,
  `USER_PLUGINS_DIRS`). Formato **Agent Plugins 1.0.0**: `plugin.json` +
  `mcp.json` **alla radice** (schema vendored in
  `openhands/sdk/plugin/format/schemas/`). Il repo `cloudflare/skills` **e' gia'
  un plugin** in quel formato. Installazione fatta: copiati `plugin.json`,
  `mcp.json` e `skills/` in `~/.agents/plugins/cloudflare/`.
  MCP = `{"type":"streamable-http","url":"https://mcp.cloudflare.com/mcp"}`.
- **OAuth**: `mcp.cloudflare.com/mcp` → 401 senza auth. Discovery in
  `/.well-known/oauth-authorization-server`; l'OAuth scatta al primo uso dei
  tool (serve autorizzazione browser dell'utente).
- **CLI `cf`** (opzionale, beta): `npm install -g cf` + `cf auth login`.
- **Lettura del binario**: `openhands-agent-server` e' un bundle PyInstaller; per
  ispezionare il codice usare `pip install pyinstxtractor-ng` +
  `python3 -m pyinstxtractor_ng <bin>`, poi disassemblare i `.pyc` con
  `marshal`+`dis` (py3.13, header 16 byte). Le costanti stringa si vedono cosi'.
- Trappola: i path passati a `Plugin.load` da `_load_plugins_from_dir` NON
  includono `~/.claude/plugins`; `~/.claude/skills` invece e' usato per le skill.

### Domini gratis — ricerca approfondita 2026-11-07
Contesto: serve un dominio che si possa **zonare su Cloudflare** (per il Worker).
Requisiti reali: (1) nella **Public Suffix List** (PSL) e (2) **nameserver
custom** (NS). Un semplice CNAME NON basta: il Custom Domain di un Worker
richiede che la zona sia su Cloudflare.

**Verificato con PSL (publicsuffix.org) + probe HTTP + DNS Google.**

Utilizzabili col Worker (PSL ✅ + NS custom ✅):
| Servizio | Suffisso gratis | PSL | Note |
|---|---|---|---|
| eu.org | `*.eu.org` | ✅ | no-profit dal 1996, alta fiducia, LENTO (settimane). Gia' in corso. |
| DigitalPlat | `.us.kg .dpdns.org .qzz.io .xx.kg` | ✅ | NS custom ("bring your own DNS"), veloce. `.qd.je` NON in PSL. |
| DNSHE | `.de5.net .us.ci .cc.cd` | ✅ | NS custom. `.bot.cd` NON in PSL. Servizio cinese, fiducia media. |
| pp.ua | `*.pp.ua` | ✅ | via nic.ua, registrazione a scadenza annuale. |
| netlib.re | `*.netlib.re` | ✅ | progetto piccolo. |
| deSEC/dedyn.io | `*.dedyn.io` | ✅ | DNS gestito da deSEC (NS non puntabili a CF → verifica caso d'uso). |

NON usabili con Cloudflare:
- isroot.in — fuori PSL, no NS custom.
- freedns.afraid.org — fuori PSL.
- open-domains.net — fuori PSL.
- **is-a.dev / is-a.bot / js.org** — PSL ✅ ma **solo record via PR GitHub**
  (no NS custom): niente zona CF. is-a.dev e' supportato da Cloudflare
  "Project Alexandria" ma resta CNAME-only.

Morti/inaffidabili: Freenom (`.tk .ml .ga .cf`) morto; `nic.us.kg` 522.

Disponibilita' `skillforge` (DNS, oggi): liberi su eu.org, us.kg, dpdns.org,
qzz.io, de5.net, pp.ua, netlib.re, dedyn.io. **Occupati**: `is-a.dev`, `js.org`.
Paga: `skillforge.tools` e `skillforge.works` LIBERI (RDAP 404, no DNS);
`.com .net .org .dev .app .io .eu .ai .cloud .tech .design .software` occupati.

GoDaddy: blocca questo ambiente (403 Akamai) su tutte le pagine; prezzi letti
via `https://r.jina.ai/<url>` (reader proxy). Promo `.COM` $4.99 con `GDWELCOME`
(1o anno, solo nuovi clienti, rinnovo $24.99). `.tools` $14.99 → **rinnovo
$61.99** (trappola classica). Meglio Cloudflare Registrar/Porkbun (a costo).

### Domini gratis senza numero di telefono — 2026-11-07
Verificato leggendo i form di registrazione (campi `required`).
- **eu.org**: il telefono (`ph1`) e' **OPZIONALE** (il form marca required solo
  nome, email, indirizzo, policy). NB: **non usare Gmail** — eu.org avvisa che
  gmail.com scarta le sue email di validazione come spam. Registrazione via
  "contact handle" + password, validazione via email.
- **DNSHE** (`my.dnshe.com/register.php`): bastano **email + password**;
  telefono/indirizzo presenti ma NON obbligatori. Offre `.de5.net .us.ci .cc.cd`.
- **DigitalPlat**: form email chiede il telefono, ma offre **Continue with
  Google / GitHub** (probabile scorciatoia, non verificato senza account).
- **pp.ua** (nic.ua): signup = email + password, ma il pp.ua e' noto per la
  **verifica telefonica** in fase di attivazione → da evitare se il vincolo e'
  "niente telefono".
- **netlib.re**: nessun form pubblico trovato (sito OpenBSD httpd, 404 su
  /register); registrazione poco chiara → fiducia bassa.

### DNSHE — scheda approfondita (navigato a fondo, 2026-11-07)
- Sito: https://www.dnshe.com/ ; signup https://my.dnshe.com/register.php ;
  login/clientarea https://my.dnshe.com/clientarea.php ; dominio hub
  https://my.dnshe.com/index.php?m=domain_hub (redirect al login se anonimo).
- Login anche con **Google / GitHub** (oltre email+password).
- Suffissi: `.de5.net`, `.us.ci`, `.cc.cd`, `.bot.cd` (`.bot.cd` NON in PSL).
  "More extensions available in the console". Extra: **email gratis `@V.cd`**
  (mail.v.cd) e servizio DDNS.
- NS reali: `a/b.ns.dnshe.org` (.de5.net, .cc.cd) e `a/b.nic.dnshe.org`
  (.us.ci, .bot.cd). Il suffisso `www.de5.net` risolve su IP **Cloudflare**
  (104.21.x / 172.67.x) => DNSHE gira su Cloudflare, quindi CF e' compatibile.
- Modello: gratis 1 anno, **rinnovo gratis** (finestra 180 gg prima della
  scadenza) oppure "Permanent Domain Upgrade" gratuito invitando amici.
- Supporta **NS custom** ("Can I use my own DNS servers? Yes") + record A/AAAA/
  CNAME/MX/TXT/NS/SRV/CAA + DNSSEC + routing per paese/ISP. TTL fino a 1s.
  Record **illimitati** (batte il limite 200 di CF free).
- **API v2**: endpoint `https://api005.dnshe.com/index.php?m=domain_hub`,
  auth header `X-API-Key` + `X-API-Secret` (formato `cfsd_...`), rate 30-60/min.
  Endpoint: `subdomains` (list/register/get/delete/renew), `dns_records`
  (list/create/update/delete), `keys`, `quota`. Guida:
  https://my.dnshe.com/knowledgebase/13/DNSHE-Free-Domain-API-User-Guide-V2.0.html
- Natura: "non-profit domain distribution platform" di un team di giovani a
  Singapore, progetto partito 2024, aperto 2025. Fiducia **media** (giovane).
- Tutte le pagine dietro **Cloudflare Turnstile** (browser reale ok; curl no).

### Servizi "come DNSHE" (sottodominio gratis + NS custom) — 2026-11-07
Cercato su GitHub topics (free-domain/free-subdomain), liste curate
(harys722/free-domains 96 servizi, abint7/free-domains) e probe diretto.
Regola: per Cloudflare servono **PSL + delega NS**. I servizi "stile is-a.dev"
(fork+PR su GitHub, solo record A/CNAME) **non** vanno bene.

**In PSL + NS custom (usabili come DNSHE):**
- DigitalPlat — `.us.kg .dpdns.org .qzz.io .xx.kg` (anche `.qd.je` NO)
- DNSHE — `.de5.net .us.ci .cc.cd` (`.bot.cd` NO)
- pp.ua, netlib.re, eu.org, deSEC/dedyn.io

**NS custom ma NON in PSL** (attenzione: Cloudflare vuole eTLD+1 in PSL):
- **Intent** (`int.yt .xo.kg .nc.to .rh.to .yn.to .gw.to`) — non-profit
  fiscalmente sponsorizzato da **Hack Club 501(c)(3)**, NS delegation
  supportata, ma i suoi suffissi NON sono in PSL.
- **vexr.dev / is-local.host** — dichiara ESPLICITAMENTE di non essere in PSL.
- is-an.app — supporta record NS, non in PSL.

**Solo CNAME/A via PR GitHub (niente NS → niente zona CF):** is-a.dev (in PSL
ma CNAME-only), is-a.bot, js.org, open-domains, thedev.id/.me, jsid.dev,
is-a.co, is-really.cool, js.cool, rweb.site, foo.ng, runs-on.dev, cluster.ws,
wip.la, io.day, dee.al, withcoding.me, tilde.tk.
Disponibilita': `skillforge` libero su int.yt, xo.kg, nc.to, de5.net, eu.org...

### skillforge.cc.cd — "dns status unresolved" (2026-11-07)
L'utente ha registrato `skillforge.cc.cd` su DNSHE. Stato mostrato dal pannello:
**"dns status unresolved"**. Diagnosi fatta con query raw UDP ai NS autorevoli:
- `a.ns.dnshe.org` (23.106.44.52) e `b.ns.dnshe.org` (165.140.240.53)
  rispondono **rcode=3 (NXDOMAIN)** per `skillforge.cc.cd` su A/NS/SOA/CNAME.
- Stessa cosa da Google DNS (Status=3) e rdap.org (404).
- Controllo di sanita': gli stessi NS rispondono rcode=0 per `cc.cd` e `de5.net`,
  e `www.de5.net` risolve su IP Cloudflare. Quindi i NS funzionano: il nome
  `skillforge.cc.cd` **non e' pubblicato** nella zona.
- Conclusione: la **delega non e' attiva**. "Unresolved" = il delegation-check di
  DNSHE non ha (ancora) confermato che i NS assegnati sono pubblicati nel parent.
- API DNSHE v1 (`m=dns`, Bearer `adns_...`): `GET /v1/zones/{id}/delegation`
  legge l'ultimo esito; `POST /v1/zones/{id}/delegation/check` rifa il check ma
  con **cooldown 2 ore** (429 `delegation_check_cooldown`). Errori utili:
  `zone_reconciliation_pending` (503) = creazione zona ancora in riconciliazione;
  "Do not immediately submit the same zone creation request again".
- Nota: nel prodotto DNS hosting, i record **NS non si creano come record normali**
  ("controlled by the administrator"); ma il prodotto Free Domains (domain_hub)
  permette di **cambiare NS** (FAQ: "Can I use my own DNS servers? Yes").
- Prossimi passi consigliati: attendere propagazione/riconciliazione, poi usare
  "Check delegation" nel pannello (max 1 volta/2h), altrimenti ticket
  (risposta < 24h). NON riregistrare il dominio.
