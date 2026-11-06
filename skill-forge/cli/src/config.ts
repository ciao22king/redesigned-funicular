import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync, existsSync } from 'node:fs';

/**
 * Configurazione della CLI, in `~/.config/skill-forge/config.json`.
 *
 * Contiene il token GitHub dell'utente e l'URL del servizio. Il file e' scritto
 * con permessi 600 (solo il proprietario): il token e' una credenziale, non deve
 * essere leggibile da altri utenti della macchina.
 *
 * L'URL si puo' forzare con SKILL_FORGE_URL (utile per puntare a un worker di
 * prova) e il token con SKILL_FORGE_TOKEN (utile in CI, dove non c'e' un file
 * di config).
 */

export const DEFAULT_URL = 'https://skill-forge.ciao22king.workers.dev';

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

/** Legge la config dal disco, fondendola con le variabili d'ambiente. */
export function loadConfig(): Config {
  let stored: Partial<Config> = {};
  const path = configPath();
  if (existsSync(path)) {
    try {
      stored = JSON.parse(readFileSync(path, 'utf8')) as Partial<Config>;
    } catch {
      // File corrotto: si riparte dai valori di default invece di bloccarsi.
      stored = {};
    }
  }

  return {
    url: (process.env.SKILL_FORGE_URL || stored.url || DEFAULT_URL).replace(/\/+$/, ''),
    token: process.env.SKILL_FORGE_TOKEN || stored.token,
    login: stored.login,
  };
}

/** Scrive la config su disco con permessi ristretti. */
export function saveConfig(config: Config): void {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = configPath();
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  // `writeFileSync` non cambia i permessi di un file esistente: li forziamo,
  // cosi' un file creato in precedenza piu' permissivo viene corretto.
  chmodSync(path, 0o600);
}

/** Rimuove la config (logout). Non fallisce se non esiste. */
export function clearConfig(): void {
  rmSync(configPath(), { force: true });
}
