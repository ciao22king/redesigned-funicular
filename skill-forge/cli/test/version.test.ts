import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

/**
 * The version the CLI reports must be the version the package is published as.
 *
 * They were two separate literals once, and they drifted: the package said
 * 0.1.1 while `--version` said 0.1.0. The CLI now reads the manifest, so this
 * test is the guard that keeps it that way — it fails the moment someone
 * reintroduces a literal.
 */

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { version: string };

/** Captures what the CLI writes to stdout while running `argv`. */
async function captureVersion(): Promise<string> {
  const original = process.stdout.write.bind(process.stdout);
  let out = '';
  process.stdout.write = ((chunk: string | Uint8Array) => {
    out += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    await main(['--version']);
  } finally {
    process.stdout.write = original;
  }
  return out.trim();
}

test('la versione del CLI coincide con quella di package.json', async () => {
  const printed = await captureVersion();
  assert.equal(printed, pkg.version);
});

test('la versione e una stringa semver, non un letterale fisso', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+/);
});
