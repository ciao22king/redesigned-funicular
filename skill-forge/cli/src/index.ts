#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { commands } from './commands/registry.js';
import { loadConfig } from './config.js';
import { error, info, color } from './output.js';
import type { Context } from './commands/types.js';

/**
 * Entry point della CLI.
 *
 * Responsabilita' minime: separare i flag globali, trovare il comando, passargli
 * il resto. Ogni comando decide cosa fare e restituisce un codice di uscita.
 * Un errore non gestito diventa un messaggio leggibile, non uno stack trace.
 */

const VERSION = '0.1.0';

/** Estrae i flag globali, lasciando intatti gli argomenti del comando. */
function splitGlobals(argv: string[]): { globals: Context; rest: string[] } {
  const rest: string[] = [];
  const globals: Context = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') globals.json = true;
    else if (a === '--url') globals.url = argv[++i];
    else if (a === '--token') globals.token = argv[++i];
    else rest.push(a);
  }
  return { globals, rest };
}

function help(): void {
  const width = Math.max(...commands.map((c) => c.usage.length));
  info(`${color.bold('skill-forge')} ${color.dim(`v${VERSION}`)}`);
  info('Genera, pubblica e scarica skill per agenti AI dal terminale.\n');
  info(color.bold('USO'));
  info('  skill-forge <comando> [opzioni]\n');
  info(color.bold('COMANDI'));
  for (const c of commands) {
    info(`  ${c.usage.padEnd(width)}  ${c.summary}`);
  }
  info(`\n${color.bold('OPZIONI GLOBALI')}`);
  info('  --json            output in JSON, per scripting');
  info('  --url <url>       URL del servizio (default: il worker pubblico)');
  info('  --token <token>   token GitHub (default: config, $SKILL_FORGE_TOKEN o `gh auth token`)');
  info(`\n${color.bold('ESEMPI')}`);
  info('  skill-forge login');
  info('  skill-forge generate -f note.md -o skill.md');
  info('  cat appunti.txt | skill-forge generate > skill.md');
  info('  skill-forge publish -f skill.md --tags docker,deploy');
  info('  skill-forge list -q docker -s stars');
  info('  skill-forge pull ciao22king/docker-deploy -o skill.md');
}

export async function main(argv: string[]): Promise<number> {
  const { globals, rest } = splitGlobals(argv);
  const name = rest[0];
  const args = rest.slice(1);

  if (!name || name === 'help' || name === '--help' || name === '-h') {
    help();
    return 0;
  }
  if (name === 'version' || name === '--version' || name === '-v') {
    info(VERSION);
    return 0;
  }

  const command = commands.find((c) => c.name === name);
  if (!command) {
    error(`Comando sconosciuto: ${name}`);
    info(`Esegui ${color.bold('skill-forge help')} per l'elenco dei comandi.`);
    return 1;
  }

  if (command.needsAuth && !effectiveToken(globals)) {
    error('Serve un token. Esegui prima: skill-forge login');
    return 1;
  }

  try {
    return await command.run(args, globals);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'errore sconosciuto';
    error(message);
    return 1;
  }
}

function effectiveToken(globals: Context): string | undefined {
  return globals.token ?? process.env.SKILL_FORGE_TOKEN ?? loadConfig().token;
}

// Esegue solo quando lanciato come binario, non quando importato dai test.
// `realpathSync` risolve i symlink che npm crea in node_modules/.bin.
function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
