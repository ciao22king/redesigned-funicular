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
  installs 19 skills to `~/.agents/skills/` and symlinks them into
  `~/.openhands/skills/`. The CLI auto-detects this agent as "OpenHands".
  Verify with `npx -y skills list -g`.
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
