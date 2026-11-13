import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync, existsSync } from 'node:fs';

/**
 * CLI configuration, in `~/.config/skill-forge/config.json`.
 *
 * Holds the user's GitHub token and the service URL. The file is written with
 * mode 600 (owner only): the token is a credential, it must not be readable by
 * other users of the machine.
 *
 * The URL can be forced with SKILL_FORGE_URL (useful to point at a test worker)
 * and the token with SKILL_FORGE_TOKEN (useful in CI, where there is no config
 * file).
 */

export const DEFAULT_URL = 'https://skillforge.cc.cd';

export interface Config {
  url: string;
  token?: string;
  login?: string;
}

/** Cartella di config, rispettando XDG_CONFIG_HOME se impostata. */
export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.trim() ? xdg : join(homedir(), '.config');
  return join(base, 'skill-forge');
}

export function configPath(): string {
  return join(configDir(), 'config.json');
}

/** Reads the config from disk, merging it with the environment variables. */
export function loadConfig(): Config {
  let stored: Partial<Config> = {};
  const path = configPath();
  if (existsSync(path)) {
    try {
      stored = JSON.parse(readFileSync(path, 'utf8')) as Partial<Config>;
    } catch {
      // Corrupt file: start over from the defaults instead of getting stuck.
      stored = {};
    }
  }

  return {
    url: (process.env.SKILL_FORGE_URL || stored.url || DEFAULT_URL).replace(/\/+$/, ''),
    token: process.env.SKILL_FORGE_TOKEN || stored.token,
    login: stored.login,
  };
}

/** Writes the config to disk with restricted permissions. */
export function saveConfig(config: Config): void {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = configPath();
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  // `writeFileSync` does not change the permissions of an existing file: we
  // force them, so a previously created, more permissive file is corrected.
  chmodSync(path, 0o600);
}

/** Removes the config (logout). Does not fail if it does not exist. */
export function clearConfig(): void {
  rmSync(configPath(), { force: true });
}
