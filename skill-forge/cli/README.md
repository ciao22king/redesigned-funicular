# skill-forge CLI

Generate, publish and pull skills for AI agents straight from the terminal.

It talks to the same service as the web interface
(`https://skillforge.cc.cd`) through the public API. It does
not touch the database and has no runtime dependencies: just Node 18 or later.

## Install

From npm:

```bash
npm install -g @ciao223/skill-forge-cli
skill-forge login
```

From source:

```bash
cd cli
npm install
npm run build
npm link        # makes the `skill-forge` and `sf` commands available
```

Without `npm link`, run it directly:

```bash
node dist/index.js help
```

## Authentication

```bash
skill-forge login          # Device Flow: shows a code, you type it in the browser
skill-forge login --token ghp_xxx   # explicit token
skill-forge logout         # removes the config
```

`login` starts GitHub's **Device Flow**: it prints a code, you open
`github.com/login/device`, enter it and authorize. The CLI waits and saves the
token as soon as it arrives. Nothing to copy and paste.

The token ends up in `~/.config/skill-forge/config.json` with mode `600`.

Token sources, in order of priority:

1. `--token <token>`
2. the `SKILL_FORGE_TOKEN` variable
3. `gh auth token`, if the GitHub CLI is installed and authenticated
4. Device Flow (interactive terminal only)

In a non-interactive context (CI, pipe) the Device Flow makes no sense, so the
CLI uses `--token`, `$SKILL_FORGE_TOKEN` or `gh auth token`. With
`--no-device-flow` you skip the interactive flow even at a terminal.

The token is only needed by the commands that write (`generate`, `publish`,
`star`, `delete`, `whoami`). `list`, `search`, `show` and `pull` work without it.

## Commands

| Command | What it does |
| --- | --- |
| `login [--token <t>]` | Authenticate via Device Flow and save the token |
| `logout` | Remove the token |
| `whoami` | Authenticated user and remaining quota |
| `generate` | Generate a skill (from files or from scratch) |
| `publish` | Publish a skill to the marketplace |
| `browse` / `ui` | Browse the marketplace interactively, with the mouse |
| `list` / `search` | Search and browse the marketplace |
| `show <id>` | Detail of a skill, markdown included |
| `pull <id>` | Download a skill as a `.md` file |
| `star <id>` | Star or unstar a skill |
| `delete <id>` | Delete one of your skills |

## Interactive browser

`skill-forge browse` opens the marketplace in a full-screen view you drive with
the keyboard or the mouse. It is for reading, not scripting: `list` and `pull`
stay the commands to use in a pipe.

- Arrow keys or `j`/`k` move, `PgUp`/`PgDn`, `Home`/`End` jump.
- `Enter` opens the selected skill, or toggles the section under the cursor.
- Click a row to open it; click a section title to open or close that section.
- The wheel scrolls the list and the document.
- `/` searches, `Esc` goes back, `?` shows the help, `q` quits.

Inside a skill the document is cut at its `##` headings: each section is one
clickable line, open or closed on demand, so a long skill stays navigable.

The view needs a real terminal. In a pipe it stops with a message pointing at
`list` instead of waiting for keys that will never arrive.

### Global options

| Option | Effect |
| --- | --- |
| `--json` | JSON output, for scripting |
| `--url <url>` | Service URL (default: the public worker) |
| `--token <token>` | GitHub token for this invocation |

## Examples

```bash
# Generate from a file and save the result
skill-forge generate -f note.md -o skill.md

# Generate from pasted text, in a pipe
cat notes.txt | skill-forge generate > skill.md

# Generate from scratch, with the wizard fields
skill-forge generate --name "Docker Deploy" \
  --domain "DevOps" --goal "Automate the release" \
  -o docker.md

# Generate and publish in one shot
cat note.md | skill-forge generate --quiet | skill-forge publish --tags docker,deploy

# Search, view, download
skill-forge list -q docker -s stars
skill-forge show ciao22king/docker-deploy
skill-forge pull ciao22king/docker-deploy -o skill.md

# Star and delete
skill-forge star ciao22king/docker-deploy
skill-forge delete ciao22king/docker-deploy --yes
```

## Development

```bash
npm test        # tests (node:test + tsx), no real network
npm run build   # compile into dist/
npm run dev     # watch build
```

The tests cover the config (including the file permissions), the HTTP client
(with a fake `fetch`), the skill helpers, the formatting and an end-to-end path
against a real local HTTP server.
