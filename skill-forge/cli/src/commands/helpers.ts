import { Client } from '../api.js';
import { loadConfig } from '../config.js';
import type { Context } from './types.js';

/** Effective config: file on disk, with the global flag overrides. */
export function loadConfigFor(ctx: Context) {
  const config = loadConfig();
  return {
    ...config,
    url: ctx.url ? ctx.url.replace(/\/+$/, '') : config.url,
    token: ctx.token ?? config.token,
  };
}

/** Ready-to-use client, or an error if the token is missing. */
export function requireClient(ctx: Context): Client {
  const config = loadConfigFor(ctx);
  return Client.fromConfig(config);
}
