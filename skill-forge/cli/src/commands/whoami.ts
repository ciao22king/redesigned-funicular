import { info, error, color } from '../output.js';
import { requireClient } from './helpers.js';
import type { Command } from './types.js';

export const whoamiCommand: Command = {
  name: 'whoami',
  usage: 'whoami',
  summary: "Mostra l'utente autenticato e la quota residua",
  needsAuth: true,
  async run(_args, ctx) {
    const client = requireClient(ctx);
    try {
      const me = await client.me();
      if (ctx.json) {
        info(JSON.stringify(me, null, 2));
        return 0;
      }
      info(`${color.bold(me.login)}`);
      if (me.quota.unlimited) {
        info(color.dim('Generazioni: illimitate'));
      } else {
        info(color.dim(`Generazioni oggi: ${me.quota.used}/${me.quota.limit}`));
      }
      return 0;
    } catch (err) {
      error(err instanceof Error ? err.message : 'richiesta fallita');
      return 1;
    }
  },
};
