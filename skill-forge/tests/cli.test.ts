import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CLI_BINARIES,
  CLI_COMMANDS,
  CLI_INSTALL_COMMAND,
  CLI_PACKAGE,
  CLI_STEPS,
  CLI_TOKEN_SOURCES,
} from '../src/lib/cli';

const here = dirname(fileURLToPath(import.meta.url));
const cliPackage = JSON.parse(
  readFileSync(join(here, '..', 'cli', 'package.json'), 'utf8'),
) as { name: string; bin: Record<string, string>; engines?: { node?: string } };

// The site and the published package must agree: if someone renames the npm
// package and forgets the site (or the reverse), this fails before deploy.
test('il nome del pacchetto sul sito coincide con quello pubblicato', () => {
  assert.equal(CLI_PACKAGE, cliPackage.name);
});

test('il comando di install usa il nome del pacchetto', () => {
  assert.equal(CLI_INSTALL_COMMAND, `npm install -g ${CLI_PACKAGE}`);
});

test('i binari elencati sul sito sono quelli del pacchetto', () => {
  assert.deepEqual([...CLI_BINARIES].sort(), Object.keys(cliPackage.bin).sort());
});

test('ogni comando documentato non e vuoto e ha una descrizione', () => {
  assert.ok(CLI_COMMANDS.length > 0);
  for (const c of CLI_COMMANDS) {
    assert.ok(c.usage.startsWith('skill-forge '), `usage inatteso: ${c.usage}`);
    assert.ok(c.what.length > 0, `descrizione mancante per ${c.usage}`);
  }
});

test('i comandi di lettura non richiedono un token', () => {
  const byUsage = new Map(CLI_COMMANDS.map((c) => [c.usage.split(' ')[1], c]));
  for (const readOnly of ['list', 'show', 'pull', 'browse']) {
    assert.equal(byUsage.get(readOnly)?.needsAuth, false, `${readOnly} non deve richiedere un token`);
  }
});

test('i comandi che scrivono richiedono un token', () => {
  const byUsage = new Map(CLI_COMMANDS.map((c) => [c.usage.split(' ')[1], c]));
  for (const write of ['generate', 'publish', 'star', 'delete', 'whoami']) {
    assert.equal(byUsage.get(write)?.needsAuth, true, `${write} deve richiedere un token`);
  }
});

test('i tre passi di installazione hanno un comando', () => {
  assert.equal(CLI_STEPS.length, 3);
  for (const s of CLI_STEPS) {
    assert.ok(s.code && s.code.length > 0, `passo senza comando: ${s.title}`);
  }
});

test('le fonti del token sono elencate in ordine di priorita', () => {
  assert.equal(CLI_TOKEN_SOURCES[0], '--token <token>');
  assert.ok(CLI_TOKEN_SOURCES.some((s) => s.includes('SKILL_FORGE_TOKEN')));
});
