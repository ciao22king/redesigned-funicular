#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { commands } from './commands/registry.js';
import { loadConfig } from './config.js';
import { error, info, color } from './output.js';
import type { Context } from './commands/types.js';

/**
 * CLI entry point.
 *
 * Minimal responsibilities: split the global flags, find the command, hand it
 * the rest. Each command decides what to do and returns an exit code. An
 * unhandled error becomes a readable message, not a stack trace.
 */

const VERSION = '0.1.0';

/** Extracts the global flags, leaving the command arguments intact. */
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
  info('Generate, publish and pull skills for AI agents from the terminal.\n');
  info(color.bold('USAGE'));
  info('  skill-forge <command> [options]\n');
  info(color.bold('COMMANDS'));
  for (const c of commands) {
    info(`  ${c.usage.padEnd(width)}  ${c.summary}`);
  }
  info(`\n${color.bold('GLOBAL OPTIONS')}`);
  info('  --json            JSON output, for scripting');
  info('  --url <url>       Service URL (default: the public worker)');
  info('  --token <token>   GitHub token (default: config, $SKILL_FORGE_TOKEN or `gh auth token`)');
  info(`\n${color.bold('EXAMPLES')}`);
  info('  skill-forge login');
  info('  skill-forge generate -f note.md -o skill.md');
  info('  cat notes.txt | skill-forge generate > skill.md');
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
    error(`Unknown command: ${name}`);
    info(`Run ${color.bold('skill-forge help')} for the list of commands.`);
    return 1;
  }

  if (command.needsAuth && !effectiveToken(globals)) {
    error('A token is required. Run first: skill-forge login');
    return 1;
  }

  try {
    return await command.run(args, globals);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    error(message);
    return 1;
  }
}

function effectiveToken(globals: Context): string | undefined {
  return globals.token ?? process.env.SKILL_FORGE_TOKEN ?? loadConfig().token;
}

// Runs only when launched as a binary, not when imported by the tests.
// `realpathSync` resolves the symlinks npm creates in node_modules/.bin.
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
