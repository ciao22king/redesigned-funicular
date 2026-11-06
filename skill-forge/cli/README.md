# skill-forge CLI

Genera, pubblica e scarica skill per agenti AI direttamente dal terminale.

Parla con lo stesso servizio dell'interfaccia web
(`https://skill-forge.ciao22king.workers.dev`) tramite l'API pubblica. Non tocca
il database e non ha dipendenze a runtime: solo Node 18 o superiore.

## Installazione

```bash
cd cli
npm install
npm run build
npm link        # rende disponibili i comandi `skill-forge` e `sf`
```

Senza `npm link`, si usa direttamente:

```bash
node dist/index.js help
```

## Autenticazione

Il comando `login` recupera un token GitHub e lo salva in
`~/.config/skill-forge/config.json` (permessi `600`). Le fonti, in ordine:

1. `--token <token>`
2. la variabile `SKILL_FORGE_TOKEN`
3. `gh auth token`, se la GitHub CLI è installata e autenticata
4. input interattivo

```bash
skill-forge login                       # usa gh, se disponibile
skill-forge login --token ghp_xxx       # token esplicito
skill-forge logout                      # rimuove la config
```

> **Perché non il Device Flow?** Sarebbe la scelta naturale per una CLI, ma va
> abilitato esplicitamente sulla OAuth App di GitHub e su questa è disattivato.
> Il token personale fa lo stesso lavoro e non richiede modifiche all'app.

Il token serve solo ai comandi che scrivono (`generate`, `publish`, `star`,
`delete`, `whoami`). `list`, `search`, `show` e `pull` funzionano senza.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `login [--token <t>]` | Salva e verifica il token |
| `logout` | Rimuove il token |
| `whoami` | Utente autenticato e quota residua |
| `generate` | Genera una skill (da file o da zero) |
| `publish` | Pubblica una skill sul marketplace |
| `list` / `search` | Cerca e sfoglia il marketplace |
| `show <id>` | Dettaglio di una skill, markdown incluso |
| `pull <id>` | Scarica una skill come file `.md` |
| `star <id>` | Mette o toglie la stella |
| `delete <id>` | Cancella una tua skill |

### Opzioni globali

| Opzione | Effetto |
| --- | --- |
| `--json` | Output in JSON, per scripting |
| `--url <url>` | URL del servizio (default: il worker pubblico) |
| `--token <token>` | Token GitHub per questa invocazione |

## Esempi

```bash
# Genera da un file e salva il risultato
skill-forge generate -f note.md -o skill.md

# Genera da testo incollato, in pipe
cat appunti.txt | skill-forge generate > skill.md

# Genera da zero, con i campi del wizard
skill-forge generate --name "Docker Deploy" \
  --domain "DevOps" --goal "Automatizzare il rilascio" \
  -o docker.md

# Genera e pubblica in un colpo solo
cat note.md | skill-forge generate --quiet | skill-forge publish --tags docker,deploy

# Cerca, guarda, scarica
skill-forge list -q docker -s stars
skill-forge show ciao22king/docker-deploy
skill-forge pull ciao22king/docker-deploy -o skill.md

# Stella e cancellazione
skill-forge star ciao22king/docker-deploy
skill-forge delete ciao22king/docker-deploy --yes
```

## Sviluppo

```bash
npm test        # test (node:test + tsx), nessuna rete reale
npm run build   # compila in dist/
npm run dev     # compilazione in watch
```

I test coprono config (compresi i permessi del file), il client HTTP (con
`fetch` finto), i helper sulle skill, la formattazione e un percorso
end-to-end contro un server HTTP locale vero.
