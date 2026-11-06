import { Client } from '../api.js';
import { loadConfig, saveConfig, clearConfig } from '../config.js';
import { resolveToken } from '../auth.js';
import { success, info, error, color } from '../output.js';
import { loadConfigFor } from './helpers.js';
import type { Command } from './types.js';

export const loginCommand: Command = {
  name: 'login',
  usage: 'login [--token <token>]',
  summary: "Salva il token GitHub e verifica l'accesso",
  async run(args, ctx) {
    // Priorita': --token sulla riga di comando, poi le fonti automatiche
    // (SKILL_FORGE_TOKEN, `gh auth token`, input interattivo).
    const i = args.indexOf('--token');
    const explicit = i !== -1 ? args[i + 1] : ctx.token;

    const token = await resolveToken(explicit);
    if (!token) {
      error('Nessun token disponibile.');
      info(`Crea un token su ${color.cyan('https://github.com/settings/tokens')} e passa`);
      info(`il valore con ${color.bold('skill-forge login --token <token>')}.`);
      return 1;
    }

    const config = loadConfigFor(ctx);
    const client = new Client({ url: config.url, token });

    try {
      const me = await client.me();
      saveConfig({ ...loadConfig(), url: config.url, token, login: me.login });
      success(`Autenticato come ${color.bold(me.login)}.`);
      info(color.dim('Config salvata in ~/.config/skill-forge/config.json (permessi 600).'));
      return 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'verifica fallita';
      error(`Accesso non riuscito: ${message}`);
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
