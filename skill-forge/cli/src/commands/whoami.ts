import { info, error, color } from '../output.js';
import { requireClient } from './helpers.js';
import type { Command } from './types.js';

export const whoamiCommand: Command = {
  name: 'whoami',
  usage: 'whoami',
  summary: 'Show the authenticated user and remaining quota',
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
        info(color.dim('Generations: unlimited'));
      } else {
        info(color.dim(`Generations today: ${me.quota.used}/${me.quota.limit}`));
      }
      return 0;
    } catch (err) {
      error(err instanceof Error ? err.message : 'request failed');
      return 1;
    }
  },
};
