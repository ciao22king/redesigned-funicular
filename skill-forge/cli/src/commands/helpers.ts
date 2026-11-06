import { Client } from '../api.js';
import { loadConfig } from '../config.js';
import type { Context } from './types.js';

/** Config effettiva: file su disco, con override dei flag globali. */
export function loadConfigFor(ctx: Context) {
  const config = loadConfig();
  return {
    ...config,
    url: ctx.url ? ctx.url.replace(/\/+$/, '') : config.url,
    token: ctx.token ?? config.token,
  };
}

/** Client pronto all'uso, o errore se manca il token. */
export function requireClient(ctx: Context): Client {
  const config = loadConfigFor(ctx);
  return Client.fromConfig(config);
}
