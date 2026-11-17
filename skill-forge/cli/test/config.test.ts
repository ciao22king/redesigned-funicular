import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadConfig, saveConfig, clearConfig, configPath, configDir } from '../src/config.js';

/**
 * The config holds a token: beyond the values, we verify that the file
 * permissions are restricted (600) and that the environment overrides work.
 */

let dir: string;
const savedEnv = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sf-config-'));
  process.env.XDG_CONFIG_HOME = dir;
  delete process.env.SKILL_FORGE_URL;
  delete process.env.SKILL_FORGE_TOKEN;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...savedEnv };
});

describe('config', () => {
  test('senza file usa i default', () => {
    const config = loadConfig();
    assert.equal(config.url, 'https://skillforge.cc.cd');
    assert.equal(config.token, undefined);
  });

  test('salva e rilegge token e login', () => {
    saveConfig({ url: 'https://example.test', token: 'tok', login: 'me' });
    const config = loadConfig();
    assert.equal(config.url, 'https://example.test');
    assert.equal(config.token, 'tok');
    assert.equal(config.login, 'me');
  });

  test('il file di config ha permessi 600', () => {
    saveConfig({ url: 'https://example.test', token: 'segreto' });
    const mode = statSync(configPath()).mode & 0o777;
    assert.equal(mode, 0o600);
  });

  test('corregge i permessi di un file esistente troppo permissivo', () => {
    saveConfig({ url: 'https://example.test', token: 'a' });
    // Simulates a file created earlier with broad permissions.
    writeFileSync(configPath(), JSON.stringify({ url: 'x', token: 'b' }), { mode: 0o644 });
    saveConfig({ url: 'https://example.test', token: 'c' });
    assert.equal(statSync(configPath()).mode & 0o777, 0o600);
  });

  test('normalizza l\'URL togliendo lo slash finale', () => {
    saveConfig({ url: 'https://example.test/', token: 't' });
    assert.equal(loadConfig().url, 'https://example.test');
  });

  test('SKILL_FORGE_URL e SKILL_FORGE_TOKEN vincono sul file', () => {
    saveConfig({ url: 'https://file.test', token: 'dal-file' });
    process.env.SKILL_FORGE_URL = 'https://env.test';
    process.env.SKILL_FORGE_TOKEN = 'da-env';
    const config = loadConfig();
    assert.equal(config.url, 'https://env.test');
    assert.equal(config.token, 'da-env');
  });

  test('un file corrotto non fa crashare, si torna ai default', () => {
    saveConfig({ url: 'https://example.test', token: 't' });
    writeFileSync(configPath(), '{ questo non e json');
    const config = loadConfig();
    assert.equal(config.url, 'https://skillforge.cc.cd');
  });

  test('clearConfig rimuove il file', () => {
    saveConfig({ url: 'https://example.test', token: 't' });
    assert.ok(existsSync(configPath()));
    clearConfig();
    assert.ok(!existsSync(configPath()));
    // Calling it again must not fail.
    clearConfig();
  });

  test('la cartella di config e\' skill-forge', () => {
    assert.ok(configDir().endsWith('skill-forge'));
  });
});
