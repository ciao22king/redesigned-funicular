import { execFileSync } from 'node:child_process';
import { Client } from '../api.js';
import { loadConfig, saveConfig, clearConfig } from '../config.js';
import { deviceFlowLogin } from '../device-flow.js';
import { success, info, error, color } from '../output.js';
import { loadConfigFor } from './helpers.js';
import type { Command } from './types.js';

/**
 * `login` — ottiene un token GitHub e lo salva.
 *
 * Percorso normale: Device Flow. L'utente vede un codice, lo digita su
 * github.com/login/device, autorizza. Niente da incollare.
 *
 * Se non c'e' un terminale interattivo (CI, pipe) il Device Flow non ha senso,
 * quindi si accettano `--token`, `$SKILL_FORGE_TOKEN` o `gh auth token`.
 */

/** Token da `gh auth token`, se la GitHub CLI e' installata e autenticata. */
function tokenFromGh(): string | undefined {
  try {
    const out = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

/** Verifica il token contro il servizio e restituisce il login. */
async function verify(url: string, token: string): Promise<string> {
  const client = new Client({ url, token });
  const me = await client.me();
  return me.login;
}

/** Verifica il token e, se valido, lo salva. */
async function finish(url: string, token: string): Promise<number> {
  try {
    const login = await verify(url, token);
    saveConfig({ ...loadConfig(), url, token, login });
    success(`Autenticato come ${color.bold(login)}.`);
    info(color.dim('Config salvata in ~/.config/skill-forge/config.json (permessi 600).'));
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'verifica fallita';
    error(`Accesso non riuscito: ${message}`);
    return 1;
  }
}

export const loginCommand: Command = {
  name: 'login',
  usage: 'login [--token <token>] [--no-device-flow]',
  summary: 'Autentica con GitHub (Device Flow) e salva il token',
  async run(args, ctx) {
    const i = args.indexOf('--token');
    const explicit = i !== -1 ? args[i + 1] : ctx.token;
    const config = loadConfigFor(ctx);

    // 1. Token esplicito (flag o variabile d'ambiente): niente interazione.
    const provided = explicit?.trim() || process.env.SKILL_FORGE_TOKEN?.trim();
    if (provided) return finish(config.url, provided);

    // 2. In un contesto non interattivo proviamo `gh`, poi ci fermiamo.
    const interactive = process.stdin.isTTY === true && process.stdout.isTTY === true;
    if (!interactive) {
      const gh = tokenFromGh();
      if (gh) return finish(config.url, gh);
      error('Nessun terminale interattivo: passa un token con --token o $SKILL_FORGE_TOKEN.');
      return 1;
    }

    // 3. Device Flow, salvo richiesta esplicita di saltarlo.
    if (args.includes('--no-device-flow')) {
      const gh = tokenFromGh();
      if (gh) return finish(config.url, gh);
      error('Device Flow disattivato e nessun token disponibile.');
      return 1;
    }

    try {
      const token = await deviceFlowLogin({
        onPrompt: ({ userCode, verificationUri }) => {
          info('');
          info(`  1. Apri ${color.cyan(verificationUri)}`);
          info(`  2. Inserisci il codice: ${color.bold(userCode)}`);
          info('');
          info(color.dim('In attesa che autorizzi… (Ctrl+C per annullare)'));
        },
      });
      return finish(config.url, token);
    } catch (err) {
      error(err instanceof Error ? err.message : 'accesso non riuscito');
      return 1;
    }
  },
};

export const logoutCommand: Command = {
  name: 'logout',
  usage: 'logout',
  summary: 'Rimuove il token salvato',
  async run() {
    clearConfig();
    success("Disconnesso. Il token e' stato rimosso.");
    return 0;
  },
};
